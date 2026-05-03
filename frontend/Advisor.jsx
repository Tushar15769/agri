import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./lib/firebase";
import { onSnapshot, doc } from "firebase/firestore";
import { generateBankPDF, generateCSV } from "./utils/exportService";
import "./Advisor.css";

// Components
import WeatherCard from "./weather/WeatherCard";
import Forecast from "./Forecast";
import SoilChatbot from "./SoilChatbot";
import SoilAnalysis from "./SoilAnalysis";
import SoilGuide from "./SoilGuide";
import IrrigationGuidance from "./IrrigationGuidance";
import CropProfitCalculator from "./CropProfitCalculator";
import FarmingMap from "./FarmingMap";
import FertilizerRecommendation from "./FertilizerRecommendation";
import LastUpdated from "./LastUpdated";
import AgriMarketplace from "./AgriMarketplace";
import AgriLMS from "./AgriLMS";
import QRTraceability from "./QRTraceability";
import FarmPlanner3D from "./FarmPlanner3D";
import FarmDiary from "./FarmDiary";
import CropDiseaseDetection from "./CropDiseaseDetection";
import PestManagement from "./PestManagement";

// Icons
import {
  Sun,
  Droplets,
  IndianRupee,
  Sprout,
  Languages,
  WifiOff,
  Landmark,
  Calendar,
  MessageSquare,
  Info,
  Map,
  FlaskConical,
  Layers,
  Book,
  CloudSun,
  ShieldCheck,
  Download,
  FileText,
  TrendingUp,
  BarChart3,
  Award,
} from "lucide-react";

// Store & Hooks
import { useAdvisorStore } from "./stores/advisorStore";
import { useYieldPrediction } from "./hooks/useYieldPrediction";

export default function Advisor() {
  const navigate = useNavigate();
  const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
  const WEATHER_CACHE_KEY = "advisorWeatherCache";

  const {
    farmers,
    setFarmers,
    crops,
    setCrops,
    languages,
    setLanguages,
    showWeather,
    setShowWeather,
    showSoilChatbot,
    setShowSoilChatbot,
    showSoilAnalysis,
    setShowSoilAnalysis,
    showSoilGuide,
    setShowSoilGuide,
    showFertilizerPopup,
    setShowFertilizerPopup,
    showComingSoon,
    setShowComingSoon,
    showIrrigation,
    setShowIrrigation,
    showProfitCalculator,
    setShowProfitCalculator,
    showFarmingMap,
    setShowFarmingMap,
    showCropDiseaseDetection,
    setShowCropDiseaseDetection,
    showPestManagement,
    setShowPestManagement,
    showAgriMarketplace,
    setShowAgriMarketplace,
    showAgriLMS,
    setShowAgriLMS,
    showQRTraceability,
    setShowQRTraceability,
    showFarmPlanner3D,
    setShowFarmPlanner3D,
    showFarmDiary,
    setShowFarmDiary,
    showForecast,
    setShowForecast,
    showExpertStatus,
    setShowExpertStatus,
    showBankReport,
    setShowBankReport,
  } = useAdvisorStore();

  const {
    yieldForm,
    updateYieldFormField,
    yieldPrediction,
    yieldLastUpdated,
    yieldError,
    yieldLoading,
    showYieldPopup,
    setShowYieldPopup,
    fetchYield,
    closeYieldPopup,
  } = useYieldPrediction();

  // Local States
  const [weatherStatus, setWeatherStatus] = useState("idle");
  const [weatherError, setWeatherError] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState("");
  const [weatherLastUpdated, setWeatherLastUpdated] = useState(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [coords, setCoords] = useState(null);
  const [reputation, setReputation] = useState(0);

  // Reputation Listener
  useEffect(() => {
    const userId = localStorage.getItem("userId") || auth.currentUser?.uid;
    if (!userId) return;

    const unsub = onSnapshot(doc(db, "users", userId), (doc) => {
      if (doc.exists()) {
        setReputation(doc.data().reputation || 0);
      }
    });
    return () => unsub();
  }, []);

  // Animate stats on mount
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useAdvisorStore.getState();
      if (state.farmers < 50000) setFarmers(state.farmers + 500);
      if (state.crops < 120) setCrops(state.crops + 2);
      if (state.languages < 12) setLanguages(state.languages + 1);
    }, 50);
    return () => clearInterval(interval);
  }, [setFarmers, setCrops, setLanguages]);

  // Weather Cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem(WEATHER_CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached);
      if (!parsed?.timestamp || !parsed?.data) return;
      const ageMinutes = (Date.now() - parsed.timestamp) / 60000;
      if (ageMinutes <= 30) {
        setWeatherData(parsed.data);
        setWeatherLocation(parsed.location || "");
        setWeatherLastUpdated(parsed.timestamp);
        setWeatherStatus("ready");
      }
    } catch {
      localStorage.removeItem(WEATHER_CACHE_KEY);
    }
  }, []);

  const advisories = useMemo(() => {
    if (!weatherData?.daily?.length) return [];
    const daily = weatherData.daily.slice(0, 7);
    const advisoriesList = [];

    const heatDays = daily.filter((day) => day?.temp?.max >= 38);
    if (heatDays.length >= 2) {
      advisoriesList.push({
        type: "heat",
        title: "Heatwave risk",
        message: "Plan irrigation during early hours and protect seedlings with shade nets.",
      });
    }

    const frostDays = daily.filter((day) => day?.temp?.min <= 4);
    if (frostDays.length > 0) {
      advisoriesList.push({
        type: "frost",
        title: "Frost risk",
        message: "Cover sensitive crops at night and avoid late evening irrigation.",
      });
    }

    const heavyRainDays = daily.filter((day) =>
      day?.pop >= 0.7 && ["Rain", "Thunderstorm"].includes(day?.weather?.[0]?.main)
    );
    if (heavyRainDays.length > 0) {
      advisoriesList.push({
        type: "rain",
        title: "Heavy rain alert",
        message: "Delay fertilizer application and ensure proper field drainage.",
      });
    }

    const dryStretch = daily.filter((day) => day?.pop <= 0.2).length >= 3;
    if (dryStretch) {
      advisoriesList.push({
        type: "dry",
        title: "Dry spell likely",
        message: "Consider light irrigation cycles and mulch to retain soil moisture.",
      });
    }

    return advisoriesList;
  }, [weatherData]);

  const fetchWeather = async ({ latitude, longitude, label }) => {
    if (!WEATHER_API_KEY) {
      setWeatherStatus("error");
      setWeatherError("Weather API key is missing. Add VITE_OPENWEATHER_API_KEY to your env.");
      return;
    }

    setWeatherStatus("loading");
    setWeatherError("");
    const controller = new AbortController();
    const { signal } = controller;

    try {
      const url = new URL("https://api.openweathermap.org/data/2.5/onecall");
      url.searchParams.set("lat", latitude);
      url.searchParams.set("lon", longitude);
      url.searchParams.set("exclude", "minutely,hourly,alerts");
      url.searchParams.set("units", "metric");
      url.searchParams.set("appid", WEATHER_API_KEY);

      const response = await fetch(url.toString(), { signal });
      if (!response.ok) {
        throw new Error(`Weather API error (${response.status})`);
      }

      const data = await response.json();
      const timestamp = Date.now();
      setWeatherData(data);
      setWeatherLocation(label || weatherLocation);
      setWeatherLastUpdated(timestamp);
      setWeatherStatus("ready");

      localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({
          timestamp,
          data,
          location: label || weatherLocation,
        })
      );
    } catch (error) {
      if (error?.name === "AbortError") return;
      setWeatherStatus("error");
      setWeatherError(error?.message || "Failed to load weather data.");
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setWeatherStatus("error");
      setWeatherError("Geolocation is not supported in this browser.");
      return;
    }

    setWeatherStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });
        fetchWeather({
          latitude,
          longitude,
          label: "Current location",
        });
      },
      () => {
        setWeatherStatus("error");
        setWeatherError("Unable to access your location. Please search manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLocationSearch = async (event) => {
    event.preventDefault();
    if (!locationQuery.trim()) return;
    if (!WEATHER_API_KEY) {
      setWeatherStatus("error");
      setWeatherError("Weather API key is missing. Add VITE_OPENWEATHER_API_KEY to your env.");
      return;
    }

    setWeatherStatus("loading");
    setWeatherError("");
    try {
      const geoUrl = new URL("https://api.openweathermap.org/geo/1.0/direct");
      geoUrl.searchParams.set("q", locationQuery);
      geoUrl.searchParams.set("limit", "1");
      geoUrl.searchParams.set("appid", WEATHER_API_KEY);

      const response = await fetch(geoUrl.toString());
      if (!response.ok) {
        throw new Error(`Location lookup failed (${response.status})`);
      }

      const results = await response.json();
      if (!results?.length) {
        throw new Error("Location not found. Try a nearby city or district.");
      }

      const match = results[0];
      const label = [match.name, match.state, match.country].filter(Boolean).join(", ");
      setCoords({ latitude: match.lat, longitude: match.lon });
      fetchWeather({ latitude: match.lat, longitude: match.lon, label });
    } catch (error) {
      setWeatherStatus("error");
      setWeatherError(error?.message || "Failed to search location.");
    }
  };

  const formatTemp = (value) => `${Math.round(value)}°C`;
  const formatDay = (timestamp) =>
    new Date(timestamp * 1000).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  // Export Handlers
  const handleDownloadPDF = () => {
    const data = {
      reputation,
      riskLevel: reputation > 500 ? "Low" : "Moderate",
      projectedYield: "2.4 Tons/Acre",
      marketValue: "₹ 48,000",
    };
    generateBankPDF(data);
  };

  const handleDownloadCSV = () => {
    const data = [
      ["Metric", "Value"],
      ["Reputation Score", reputation],
      ["Risk Index", reputation > 500 ? "Low" : "Moderate"],
      ["Yield Prediction", "2.4 Tons/Acre"],
      ["Market Value", "₹ 48,000"],
    ];
    generateCSV(data, "Agri_Report_Fasal_Saathi.csv");
  };

  return (
    <section className="advisor">
      <div className="floating-icons">
        <span>🌱</span>
        <span>☀️</span>
        <span>💧</span>
        <span>₹</span>
      </div>

      <div className="advisor-hero">
        <h1 className="fade-in">🌱 <span className="notranslate">AI-Powered Agricultural Advisor</span></h1>
        <p className="fade-in">
          Personalized guidance for <span className="highlight">weather</span>,{" "}
          <span className="highlight">markets</span>, and{" "}
          <span className="highlight">soil health</span>.
        </p>
        <button
          className="get-started shine"
          onClick={() => setShowSoilChatbot(true)}
        >
          🚀 <span className="notranslate">Get Started</span>
        </button>
      </div>

      <div className="advisor-stats">
        <div className="stat">
          <h2><span className="stat-number">{farmers.toLocaleString()}</span>{farmers >= 50000 && <span className="stat-plus">+</span>}</h2>
          <p><span className="notranslate">Farmers Connected</span></p>
        </div>
        <div className="stat">
          <h2><span className="stat-number">{crops}</span>{crops >= 120 && <span className="stat-plus">+</span>}</h2>
          <p><span className="notranslate">Crops Analyzed</span></p>
        </div>
        <div className="stat">
          <h2><span className="stat-number">{languages}</span>{languages >= 12 && <span className="stat-plus">+</span>}</h2>
          <p><span className="notranslate">Languages Available</span></p>
        </div>
      </div>

      <div className="advisor-highlights">
        <h2 className="slide-in">✨ <span className="notranslate">Features</span></h2>
        
        <div className="cards">
          {/* Reputation Card */}
          <div className="card reveal expert-card" onClick={() => setShowExpertStatus(true)}>
            <div className="icon">
              <ShieldCheck size={32} color="#16a34a" />
            </div>
            <div className="card-header-badge">
              <h3>Expert Status</h3>
              <span className="reputation-badge">{reputation} pts</span>
            </div>
            <p>Earn reputation by helping the community. Higher points unlock premium advisor tools.</p>
            <div className="reputation-progress-mini">
              <div className="progress-bar-inner" style={{ width: `${Math.min(100, (reputation / 1000) * 100)}%` }}></div>
            </div>
          </div>

          {/* Bank Report Card */}
          <div className="card reveal bank-report-card" onClick={() => setShowBankReport(true)}>
            <div className="icon">
              <Landmark size={32} color="#2563eb" />
            </div>
            <h3>Bank Reports & Export</h3>
            <p>Generate professional financial and risk reports for loan applications and crop insurance.</p>
            <div className="export-preview-icons">
              <FileText size={18} />
              <BarChart3 size={18} />
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="card reveal" onClick={() => navigate("/crop-planner")}>
            <div className="icon">
              <Calendar size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Seasonal Crop Planner</span></h3>
            <p>Plan your crops throughout the year with seasonal recommendations and crop rotation cycles.</p>
          </div>

          <div className="card reveal" onClick={() => setShowWeather(true)}>
            <div className="icon">
              <Sun size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Weather Intelligence</span></h3>
            <p>Get hyperlocal weather forecasts, alerts, and crop-specific advisories.</p>
          </div>

          <div className="card reveal" onClick={() => setShowForecast(true)}>
            <div className="icon">
              <CloudSun size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">7-Day Forecast</span></h3>
            <p>Detailed weekly weather outlook to plan your farming activities.</p>
          </div>

          <div className="card reveal" onClick={() => navigate("/community")}>
            <div className="icon">
              <MessageSquare size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Farmer Community</span></h3>
            <p>Connect, share tips, and learn from other farmers in your region.</p>
          </div>

          <div className="card reveal" onClick={() => setShowIrrigation(true)}>
            <div className="icon">
              <Droplets size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Irrigation Guidance</span></h3>
            <p>Water-saving tips and irrigation schedules tailored to your crops.</p>
          </div>

          <div className="card reveal" onClick={() => navigate("/market-prices")}>
            <div className="icon">
              <IndianRupee size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Market Price Guidance</span></h3>
            <p>Market trends and price alerts to help you sell at the best time.</p>
          </div>

          <div className="card reveal" onClick={() => setShowSoilAnalysis(true)}>
            <div className="icon">
              <FlaskConical size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Soil Analysis</span></h3>
            <p>Analyze NPK nutrients and get personalized crop & fertilizer recommendations.</p>
          </div>

          <div className="card reveal" onClick={() => setShowSoilGuide(true)}>
            <div className="icon">
              <Layers size={32} strokeWidth={2} />
            </div>
            <h3>Soil Type Guide</h3>
            <p>Explore major soil types in India and find the most suitable crops for your land.</p>
          </div>

          <div className="card reveal" onClick={() => setShowCropDiseaseDetection(true)}>
            <div className="icon">🌿</div>
            <h3><span className="notranslate">Disease Detection</span></h3>
            <p>Upload plant images to detect diseases and get remedies using AI.</p>
          </div>

          <div className="card reveal" onClick={() => setShowFertilizerPopup(true)}>
            <div className="icon">🌾</div>
            <h3><span className="notranslate">Fertilizer Plan</span></h3>
            <p>Get a crop-aware fertilizer plan based on soil pH and nutrient status.</p>
          </div>

          <div className="card reveal" onClick={() => setShowYieldPopup(true)}>
            <div className="icon">📊</div>
            <h3><span className="notranslate">Yield Prediction</span></h3>
            <p>AI predicts crop yield based on soil & weather data.</p>
          </div>

          <div className="card reveal" onClick={() => setShowAgriMarketplace(true)}>
            <div className="icon">🚜</div>
            <h3><span className="notranslate">Agri Marketplace</span></h3>
            <p>Rent or list farm equipment locally. Save costs and earn extra.</p>
          </div>

          <div className="card reveal" onClick={() => setShowAgriLMS(true)}>
            <div className="icon">🎓</div>
            <h3><span className="notranslate">Agri Academy</span></h3>
            <p>Access video tutorials on modern farming and earn completion certificates.</p>
          </div>

          <div className="card reveal" onClick={() => setShowQRTraceability(true)}>
            <div className="icon">🔍</div>
            <h3><span className="notranslate">QR Traceability</span></h3>
            <p>Generate QR codes for your produce. Let customers trace their food.</p>
          </div>

          <div className="card reveal" onClick={() => setShowFarmPlanner3D(true)}>
            <div className="icon">🗺️</div>
            <h3><span className="notranslate">3D Farm Planner</span></h3>
            <p>Design your farm layout in interactive 3D. Optimize land usage.</p>
          </div>

          <div className="card reveal" onClick={() => setShowProfitCalculator(true)}>
            <div className="icon">💰</div>
            <h3><span className="notranslate">Profit Calculator</span></h3>
            <p>Calculate your crop profits and ROI before planting.</p>
          </div>

          <div className="card reveal" onClick={() => setShowFarmDiary(true)}>
            <div className="icon">
              <Book size={32} strokeWidth={2} />
            </div>
            <h3><span className="notranslate">Digital Farm Diary</span></h3>
            <p>Log daily farming activities, set task reminders, and export records.</p>
          </div>
        </div>

        {/* Weather Dashboard Embedded */}
        <div className="weather-dashboard">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <h2 style={{ margin: 0 }}>🌦️ Live Weather & Advisories</h2>
            {weatherLastUpdated && <LastUpdated timestamp={weatherLastUpdated} />}
          </div>

          <div className="weather-controls">
            <button className="action-btn" type="button" onClick={handleUseMyLocation}>
              Use My Location
            </button>
            <form onSubmit={handleLocationSearch} className="search-form">
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Search by city or district"
                className="search-input"
              />
              <button className="action-btn secondary" type="submit">Search</button>
            </form>
            <button className="action-btn secondary" type="button" onClick={() => coords && fetchWeather({ latitude: coords.latitude, longitude: coords.longitude, label: weatherLocation })}>
              Refresh
            </button>
          </div>

          {weatherStatus === "ready" && weatherData?.current && (
            <div className="weather-grid">
              <div className="weather-now">
                <h3>Now</h3>
                <p className="temp-large">{formatTemp(weatherData.current.temp)}</p>
                <p>{weatherData.current.weather?.[0]?.description}</p>
                <p>Humidity: {weatherData.current.humidity}%</p>
              </div>

              <div className="weather-alerts">
                <h3>Alerts</h3>
                {advisories.length === 0 ? (
                  <p>No severe alerts expected this week.</p>
                ) : (
                  advisories.map((item) => (
                    <p key={item.title}><strong>{item.title}:</strong> {item.message}</p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showWeather && (
        <div className="weather-overlay" onClick={() => setShowWeather(false)}>
          <div className="weather-popup" onClick={(e) => e.stopPropagation()}>
            <WeatherCard onClose={() => setShowWeather(false)} />
          </div>
        </div>
      )}

      {showForecast && (
        <div className="weather-overlay" onClick={() => setShowForecast(false)}>
          <div className="weather-popup" onClick={(e) => e.stopPropagation()}>
            <Forecast onClose={() => setShowForecast(false)} />
          </div>
        </div>
      )}

      {showSoilChatbot && (
        <div className="weather-overlay" onClick={() => setShowSoilChatbot(false)}>
          <div className="chatbot-popup" onClick={(e) => e.stopPropagation()}>
            <SoilChatbot onClose={() => setShowSoilChatbot(false)} />
          </div>
        </div>
      )}

      {showSoilAnalysis && (
        <div className="weather-overlay" onClick={() => setShowSoilAnalysis(false)}>
          <div className="soil-analysis-popup" onClick={(e) => e.stopPropagation()}>
            <SoilAnalysis onClose={() => setShowSoilAnalysis(false)} />
          </div>
        </div>
      )}

      {showSoilGuide && (
        <div className="weather-overlay" onClick={() => setShowSoilGuide(false)}>
          <div className="soil-analysis-popup" onClick={(e) => e.stopPropagation()}>
            <SoilGuide onClose={() => setShowSoilGuide(false)} />
          </div>
        </div>
      )}

      {showIrrigation && (
        <div className="weather-overlay" onClick={() => setShowIrrigation(false)}>
          <div className="weather-popup" onClick={(e) => e.stopPropagation()}>
            <IrrigationGuidance onClose={() => setShowIrrigation(false)} />
          </div>
        </div>
      )}

      {showProfitCalculator && (
        <div className="weather-overlay" onClick={() => setShowProfitCalculator(false)}>
          <div className="weather-popup profit-popup" onClick={(e) => e.stopPropagation()}>
            <CropProfitCalculator onClose={() => setShowProfitCalculator(false)} />
          </div>
        </div>
      )}

      {showFertilizerPopup && (
        <div className="weather-overlay" onClick={() => setShowFertilizerPopup(false)}>
          <div className="weather-popup fertilizer-popup-shell" onClick={(e) => e.stopPropagation()}>
            <FertilizerRecommendation onClose={() => setShowFertilizerPopup(false)} />
          </div>
        </div>
      )}

      {showFarmingMap && (
        <div className="farming-map-overlay" onClick={() => setShowFarmingMap(false)}>
          <div className="farming-map-popup" onClick={(e) => e.stopPropagation()}>
            <FarmingMap onClose={() => setShowFarmingMap(false)} />
          </div>
        </div>
      )}

      {showCropDiseaseDetection && (
        <div className="weather-overlay" onClick={() => setShowCropDiseaseDetection(false)}>
          <div className="chatbot-popup" onClick={(e) => e.stopPropagation()}>
            <CropDiseaseDetection onClose={() => setShowCropDiseaseDetection(false)} />
          </div>
        </div>
      )}

      {showPestManagement && (
        <div className="weather-overlay" onClick={() => setShowPestManagement(false)}>
          <div className="chatbot-popup" onClick={(e) => e.stopPropagation()}>
            <PestManagement onClose={() => setShowPestManagement(false)} />
          </div>
        </div>
      )}

      {showAgriMarketplace && (
        <div className="weather-overlay" onClick={() => setShowAgriMarketplace(false)}>
          <div className="agri-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAgriMarketplace(false)}>×</button>
            <AgriMarketplace />
          </div>
        </div>
      )}

      {showAgriLMS && (
        <div className="weather-overlay" onClick={() => setShowAgriLMS(false)}>
          <div className="agri-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAgriLMS(false)}>×</button>
            <AgriLMS />
          </div>
        </div>
      )}

      {showQRTraceability && (
        <div className="weather-overlay" onClick={() => setShowQRTraceability(false)}>
          <div className="agri-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowQRTraceability(false)}>×</button>
            <QRTraceability />
          </div>
        </div>
      )}

      {showFarmPlanner3D && (
        <div className="weather-overlay" onClick={() => setShowFarmPlanner3D(false)}>
          <div className="agri-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowFarmPlanner3D(false)}>×</button>
            <FarmPlanner3D />
          </div>
        </div>
      )}

      {showFarmDiary && (
        <div className="weather-overlay" onClick={() => setShowFarmDiary(false)}>
          <div className="agri-modal-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowFarmDiary(false)}>×</button>
            <FarmDiary />
          </div>
        </div>
      )}

      {showYieldPopup && (
        <div className="modal" onClick={closeYieldPopup}>
          <div className="yield-popup" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeYieldPopup}>×</button>
            <h2>🌾 Crop Yield Prediction</h2>
            {!yieldPrediction ? (
              <form className="yield-form" onSubmit={(e) => { e.preventDefault(); fetchYield(); }}>
                <div className="form-group">
                  <label>Crop Name</label>
                  <input type="text" value={yieldForm.crop} onChange={(e) => updateYieldFormField("crop", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Season</label>
                  <select value={yieldForm.season} onChange={(e) => updateYieldFormField("season", e.target.value)}>
                    <option value="Kharif">Kharif</option>
                    <option value="Rabi">Rabi</option>
                    <option value="Summer">Summer</option>
                    <option value="Whole Year">Whole Year</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Area (Hectares)</label>
                  <input type="number" step="0.1" value={yieldForm.area} onChange={(e) => updateYieldFormField("area", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" value={yieldForm.state} onChange={(e) => updateYieldFormField("state", e.target.value)} required />
                </div>
                <div className="form-actions">
                  <button type="submit" className="action-btn" disabled={yieldLoading}>{yieldLoading ? "Analyzing..." : "Predict Yield"}</button>
                </div>
                {yieldError && <p className="error-msg">{yieldError}</p>}
              </form>
            ) : (
              <div className="yield-result">
                <p>Predicted Yield: <strong>{yieldPrediction.toFixed(2)}</strong> Tons/Hectare</p>
                <p>Confidence: 94%</p>
                <button className="action-btn secondary" onClick={() => updateYieldFormField("prediction", null)}>Calculate Another</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showExpertStatus && (
        <div className="weather-overlay" onClick={() => setShowExpertStatus(false)}>
          <div className="expert-status-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-expert">
              <Award size={48} color="#f59e0b" />
              <h2>Farmer Reputation & Expert Status</h2>
              <button className="close-btn" onClick={() => setShowExpertStatus(false)}>×</button>
            </div>
            <div className="reputation-details">
              <div className="rep-stat-box">
                <span className="rep-label">Total Points</span>
                <span className="rep-value">{reputation}</span>
              </div>
              <div className="rep-stat-box">
                <span className="rep-label">Expert Tier</span>
                <span className="rep-value">{reputation > 1000 ? "Master Farmer" : reputation > 500 ? "Expert" : "Contributor"}</span>
              </div>
            </div>
            <div className="expert-benefits">
              <h3>Unlocked Benefits:</h3>
              <ul>
                <li><ShieldCheck size={16} /> Verified Expert Badge on Forums</li>
                {reputation > 500 && <li><Sun size={16} /> Priority Support & Advanced Alerts</li>}
                {reputation > 1000 && <li><TrendingUp size={16} /> Direct Access to Agri-Scientists</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showBankReport && (
        <div className="weather-overlay" onClick={() => setShowBankReport(false)}>
          <div className="bank-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-bank">
              <Landmark size={40} color="#2563eb" />
              <h2>Bank Loan & Risk Reporting</h2>
              <button className="close-btn" onClick={() => setShowBankReport(false)}>×</button>
            </div>
            <div className="report-preview-section">
              <div className="preview-card">
                <h4>Report Summary</h4>
                <div className="preview-grid">
                  <div className="preview-item"><span>Risk Index:</span> <strong className="status-low">LOW</strong></div>
                  <div className="preview-item"><span>Credit Score:</span> <strong>780/900</strong></div>
                  <div className="preview-item"><span>Reputation:</span> <strong>{reputation}</strong></div>
                </div>
              </div>
              <div className="report-options">
                <h3>Export Format</h3>
                <div className="export-btns">
                  <button className="export-btn pdf" onClick={handleDownloadPDF}><Download size={20} /> Export Bank PDF</button>
                  <button className="export-btn csv" onClick={handleDownloadCSV}><Download size={20} /> Export Financial CSV</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showComingSoon && (
        <div className="modal" onClick={() => setShowComingSoon(false)}>
          <div className="modal-content">
            <h3>🚀 Coming Soon!</h3>
            <p>We are working hard to bring this feature to you. Stay tuned!</p>
            <button className="get-started" onClick={() => setShowComingSoon(false)}>Okay</button>
          </div>
        </div>
      )}
    </section>
  );
}
