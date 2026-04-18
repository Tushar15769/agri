import React, { useState, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";

import Advisor from "./Advisor";
import Home from "./Home";
import Resources from "./Resources";
import CropGuide from "./CropGuide";
import {
  FaHome,
  FaComments,
  FaInfoCircle,
  FaLeaf,
  FaBars,
  FaTimes,
  FaChevronDown,
} from "react-icons/fa";
import How from "./How";
import Auth from "./Auth";
import ProfileSetup from "./ProfileSetup";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { NavLink, Navigate, useLocation } from "react-router-dom";

import "./App.css";

/* ---------------- LANGUAGE ---------------- */

const LANGUAGE_OPTIONS = [
  { value: "en", label: "🌍 English" },
  { value: "hi", label: "🇮🇳 हिंदी" },
  { value: "mr", label: "🇮🇳 मराठी" },
  { value: "bn", label: "🇮🇳 বাংলা" },
  { value: "ta", label: "🇮🇳 தமிழ்" },
  { value: "te", label: "🇮🇳 తెలుగు" },
  { value: "gu", label: "🇮🇳 ગુજરાતી" },
  { value: "pa", label: "🇮🇳 ਪੰਜਾਬੀ" },
  { value: "kn", label: "🇮🇳 ಕನ್ನಡ" },
  { value: "ml", label: "🇮🇳 മലയാളം" },
  { value: "or", label: "🇮🇳 ଓଡ଼ିଆ" },
  { value: "as", label: "🇮🇳 অসমীয়া" },
];

const getInitialLanguage = () => {
  try {
    const stored = localStorage.getItem("preferredLanguage");
    return LANGUAGE_OPTIONS.some((l) => l.value === stored)
      ? stored
      : "en";
  } catch {
    return "en";
  }
};

/* ---------------- GOOGLE TRANSLATE CONTROL ---------------- */

const applyGoogleTranslate = (lang) => {
  const el = document.querySelector(".goog-te-combo");
  if (!el) return false;

  el.value = lang;
  el.dispatchEvent(new Event("change"));
  return true;
};

const syncLanguage = (lang, setLang) => {
  setLang(lang);
  localStorage.setItem("preferredLanguage", lang);
  applyGoogleTranslate(lang);
};

/* ---------------- APP ---------------- */

function App() {
  const [preferredLang, setPreferredLang] = useState(getInitialLanguage);
  const [isOpen, setIsOpen] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showScorecard, setShowScorecard] = useState(false);
  const location = useLocation();

  /* ---------------- THEME ---------------- */
  useEffect(() => {
    document.documentElement.classList.toggle(
      "theme-dark",
      theme === "dark"
    );
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* ---------------- LANGUAGE AUTO APPLY ---------------- */
  useEffect(() => {
    if (applyGoogleTranslate(preferredLang)) return;

    const id = setInterval(() => {
      if (applyGoogleTranslate(preferredLang)) clearInterval(id);
    }, 300);

    return () => clearInterval(id);
  }, [preferredLang]);

  /* ---------------- AUTH SESSION ---------------- */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Real-time listener for user data
        const unsubscribeDoc = onSnapshot(doc(db, "users", currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setProfileCompleted(data.profileCompleted === true);
          } else {
            setUserData(null);
            setProfileCompleted(false);
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore listener error:", error);
          setLoading(false);
        });
        
        return () => unsubscribeDoc();
      } else {
        setUserData(null);
        setProfileCompleted(true);
        setLoading(false);
      }
    });
    
    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleThemeToggle = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  /* ---------------- UI ---------------- */

  return (
    <div className={`app ${theme === "dark" ? "theme-dark" : ""}`}>

        {/* NAVBAR */}
        <nav className="navbar">
          <div className="nav-left">
            <FaLeaf className="icon" />
            <Link to="/" className="brand">
              Fasal Saathi
            </Link>
          </div>

          <ul className={`nav-center ${isOpen ? "active" : ""}`}>
            <li>
              <Link to="/" onClick={() => setIsOpen(false)}>
                <FaHome /> Home
              </Link>
            </li>
            <li>
              <Link to="/advisor" onClick={() => setIsOpen(false)}>
                <FaComments /> Chat
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" onClick={() => setIsOpen(false)}>
                <FaInfoCircle /> How It Works
              </Link>
            </li>
            <li>
              <Link to="/crop-guide" onClick={() => setIsOpen(false)}>
                <FaLeaf className="icon" /> Crop Guide
              </Link>
            </li>
          </ul>

          <div className="nav-right">
            <button onClick={handleThemeToggle}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <select
              className="lang-select notranslate"
              value={preferredLang}
              onChange={(e) =>
                syncLanguage(e.target.value, setPreferredLang)
              }
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>

            <div className="nav-user" onClick={() => setShowScorecard(!showScorecard)}>
              {loading ? (
                <span>Loading...</span>
              ) : user ? (
                <div className="user-profile-trigger">
                  <div className="profile-main">
                    <span className="profile-name">👋 {userData?.displayName || user.email.split('@')[0]}</span>
                    <FaChevronDown className={`chevron ${showScorecard ? 'open' : ''}`} />
                  </div>

                  {showScorecard && userData && (
                    <div className="profile-scorecard" onClick={(e) => e.stopPropagation()}>
                      <div className="scorecard-header">
                        <div className="scorecard-avatar">
                          {userData.displayName?.[0] || 'F'}
                        </div>
                        <h3>{userData.displayName}</h3>
                        <p>{userData.email}</p>
                      </div>
                      <div className="scorecard-body">
                        <div className="score-item">
                          <label>🌾 Primary Crop</label>
                          <span>{userData.cropType}</span>
                        </div>
                        <div className="score-item">
                          <label>🌐 Language</label>
                          <span>{LANGUAGE_OPTIONS.find(l => l.value === userData.language)?.label || userData.language}</span>
                        </div>
                        <div className="score-item">
                          <label>📍 Location</label>
                          <span>{userData.address || "Fetching..."}</span>
                        </div>
                      </div>
                      <div className="scorecard-footer">
                        <button onClick={handleLogout} className="btn-logout-alt">Sign Out</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="btn-get-started">Get Started</Link>
              )}
            </div>
          </div>

          <button
            className="hamburger"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <FaTimes /> : <FaBars />}
          </button>
        </nav>

        {/* AUTH GUARDS */}
        {!loading && user && !user.emailVerified && !showScorecard && location.pathname !== "/login" && (
          <div className="verification-overlay">
            <div className="verification-card">
              <div className="verify-icon">✉️</div>
              <h2>Verify Your Email</h2>
              <p>We've sent a link to <b>{user.email}</b>.<br/> Please verify your email to unlock all features.</p>
              <button 
                onClick={() => {
                  auth.currentUser.reload().then(() => {
                    window.location.reload();
                  });
                }} 
                className="btn-refresh"
              >
                I've Verified My Email
              </button>
              <button onClick={handleLogout} className="btn-logout-simple">Sign Out</button>
            </div>
          </div>
        )}

        {!loading && user && user.emailVerified && !profileCompleted && location.pathname !== "/profile-setup" && (
          <Navigate to="/profile-setup" />
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/advisor" element={<Advisor />} />
          <Route path="/how-it-works" element={<How />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
        </Routes>
      </div>
  );
}

export default App;
