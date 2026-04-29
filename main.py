from fastapi import FastAPI, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from whatsapp_service import send_whatsapp_message, format_alert_message
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    Crop: str
    CropCoveredArea: float = Field(..., gt=0)
    CHeight: int = Field(..., ge=0)
    CNext: str
    CLast: str
    CTransp: str
    IrriType: str
    IrriSource: str
    IrriCount: int = Field(..., ge=1)
    WaterCov: int = Field(..., ge=0, le=100)
    Season: str

class PredictResponse(BaseModel):
    predicted_ExpYield: float

# Load model
try:
    model = joblib.load("yield_model.joblib")
    print("✅ Model loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

# Local storage for WhatsApp subscribers (in a real app, this would be in Firestore/PostgreSQL)
SUBSCRIBERS_FILE = "whatsapp_subscribers.json"

def load_subscribers():
    if os.path.exists(SUBSCRIBERS_FILE):
        with open(SUBSCRIBERS_FILE, "r") as f:
            return json.load(f)
    return {}

def save_subscribers(subscribers):
    with open(SUBSCRIBERS_FILE, "w") as f:
        json.dump(subscribers, f)

class WhatsAppSubscribeRequest(BaseModel):
    phone_number: str
    user_id: str
    name: str

class AlertTriggerRequest(BaseModel):
    alert_type: str  # 'weather', 'pest', 'advisory'
    message: str

# Store notifications
notifications = [
    {
        "id": 1,
        "type": "weather",
        "message": "🌧️ Heavy rainfall expected in your region today.",
        "time": datetime.now().isoformat()
    },
    {
        "id": 2,
        "type": "recommendation",
        "message": "🌱 Ideal time to irrigate wheat crops.",
        "time": datetime.now().isoformat()
    }
]

@app.get("/")
def root():
    return {"message": "Fasal Saathi Yield Prediction API", "status": "running"}

@app.get("/predict")
def predict_get():
    return {"predicted_yield": 2500, "note": "Use POST endpoint for actual prediction"}

@app.post("/predict", response_model=PredictResponse)
def predict_yield(data: PredictRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    try:
        input_data = {
            'Crop': data.Crop,
            'CropCoveredArea': data.CropCoveredArea,
            'CHeight': data.CHeight,
            'CNext': data.CNext,
            'CLast': data.CLast,
            'CTransp': data.CTransp,
            'IrriType': data.IrriType,
            'IrriSource': data.IrriSource,
            'IrriCount': data.IrriCount,
            'WaterCov': data.WaterCov,
            'Season': data.Season
        }
        df = pd.DataFrame([input_data])
        
        dummy_cols = ['Crop', 'CNext', 'CLast', 'CTransp', 'IrriType', 'IrriSource', 'Season']
        df = pd.get_dummies(df, columns=dummy_cols, drop_first=True)
        
        feature_cols = list(model.get_booster().feature_names)
        for col in feature_cols:
            if col not in df.columns:
                df[col] = 0
        df = df[feature_cols]
        
        predicted_yield = model.predict(df)[0]
        return {"predicted_ExpYield": float(predicted_yield)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/log-error")
async def log_error(request: Request):
    """
    Receive error reports from the frontend for monitoring and debugging.
    """
    try:
        error_data = await request.json()
        print(f"[Error Log] {error_data.get('message', 'Unknown error')} | Context: {error_data.get('context', 'N/A')}")
        return {"success": True, "message": "Error logged"}
    except Exception:
        return {"success": False, "message": "Invalid error data"}

@app.get("/api/notifications")
def get_notifications():
    """Get notifications for the frontend."""
    return {"success": True, "data": notifications}

@app.post("/api/whatsapp/subscribe")
async def subscribe_whatsapp(data: WhatsAppSubscribeRequest):
    """Subscribe a user to WhatsApp alerts."""
    subscribers = load_subscribers()
    subscribers[data.user_id] = {
        "phone_number": data.phone_number,
        "name": data.name,
        "subscribed_at": datetime.now().isoformat()
    }
    save_subscribers(subscribers)
    
    # Send welcome message
    welcome_msg = f"Namaste {data.name}! 🙏\n\nWelcome to *Fasal Saathi WhatsApp Alerts*. You will now receive real-time updates on weather, pests, and farming advisories directly here.\n\nType 'STOP' at any time to unsubscribe."
    send_whatsapp_message(data.phone_number, welcome_msg)
    
    return {"success": True, "message": "Successfully subscribed to WhatsApp alerts"}

@app.post("/api/whatsapp/trigger-alert")
async def trigger_whatsapp_alert(data: AlertTriggerRequest):
    """Trigger a WhatsApp alert to all subscribers."""
    subscribers = load_subscribers()
    results = []
    
    formatted_msg = format_alert_message(data.alert_type, data.message)
    
    for user_id, info in subscribers.items():
        res = send_whatsapp_message(info["phone_number"], formatted_msg)
        results.append({"user_id": user_id, "success": res["success"]})
    
    # Also add to in-app notifications
    new_notif = {
        "id": len(notifications) + 1,
        "type": data.alert_type,
        "message": data.message,
        "time": datetime.now().isoformat()
    }
    notifications.append(new_notif)
    
    return {"success": True, "results": results}

@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(Body: str = Form(...), From: str = Form(...)):
    """
    Handle incoming messages from WhatsApp (Bot Logic).
    """
    incoming_msg = Body.lower().strip()
    sender_number = From.replace("whatsapp:", "")
    
    if "weather" in incoming_msg:
        response = "🌡️ *Current Weather Update*\n\nYour region is showing 28°C with clear skies. No heavy rain expected for the next 48 hours. It's a great time for field work!"
    elif "pest" in incoming_msg:
        response = "🐛 *Pest Management Assistant*\n\nIf you've spotted pests, please use the 'Pest Management' tool in the app for an AI-powered diagnosis."
    elif "hi" in incoming_msg or "hello" in incoming_msg:
        response = "🙏 *Namaste from Fasal Saathi!*\n\nI am your AI Farming Assistant. You can ask me about 'Weather', 'Pest', or 'Yield'."
    else:
        response = f"I received your message: '{Body}'. Try typing 'Weather' or 'Pest' for specific help. 🌱"

    from whatsapp_service import send_whatsapp_message
    send_whatsapp_message(sender_number, response)
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)