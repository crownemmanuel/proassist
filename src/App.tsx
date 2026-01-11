import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { FaHome, FaCog, FaQuestionCircle, FaSun, FaMoon, FaMicrophone } from "react-icons/fa";
import "./App.css";
// import { invoke } from "@tauri-apps/api/tauri"; // We will use this later
// import { checkUpdate, installUpdate } from '@tauri-apps/api/updater'; // Removed as it was causing a lint error and not used yet
// import { relaunch } from '@tauri-apps/api/process'; // Removed as it was causing a lint error and not used yet

// Import actual page components
import MainApplicationPage from "./pages/MainApplicationPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import MediaView from "./pages/MediaView";
import LiveSlidesNotepad from "./pages/LiveSlidesNotepad";
import { loadLiveSlidesSettings, startLiveSlidesServer } from "./services/liveSlideService";

// Navigation component that uses useLocation
function Navigation({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const location = useLocation();
  
  // Hide navigation on the notepad page for a cleaner experience
  if (location.pathname.includes("/live-slides/notepad/")) {
    return null;
  }
  
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="app-nav">
      <Link to="/" className={`nav-action-button ${isActive("/") ? "active" : ""}`}>
        <FaHome />
        <span>Main</span>
      </Link>
      <Link to="/settings" className={`nav-action-button ${isActive("/settings") ? "active" : ""}`}>
        <FaCog />
        <span>Settings</span>
      </Link>
      <Link to="/live-testimonies" className={`nav-action-button ${isActive("/live-testimonies") ? "active" : ""}`}>
        <FaMicrophone />
        <span>Live Testimonies</span>
      </Link>
      <Link to="/help" className={`nav-action-button ${isActive("/help") ? "active" : ""}`}>
        <FaQuestionCircle />
        <span>Help</span>
      </Link>
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
        className="theme-toggle-button"
      >
        {theme === "light" ? <FaMoon /> : <FaSun />}
      </button>
    </nav>
  );
}

// Wrapper component that conditionally renders the container
function AppContent({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const location = useLocation();
  const isNotepadPage = location.pathname.includes("/live-slides/notepad/");
  
  if (isNotepadPage) {
    // Notepad page gets full viewport without navigation
    return (
      <Routes>
        <Route path="/live-slides/notepad/:sessionId" element={<LiveSlidesNotepad />} />
      </Routes>
    );
  }
  
  return (
    <div className="container">
      <Navigation theme={theme} toggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<MainApplicationPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/live-testimonies" element={<MediaView />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("app-theme") || "dark"
  );

  // Auto-start Live Slides WebSocket server if enabled in settings.
  useEffect(() => {
    const settings = loadLiveSlidesSettings();
    if (!settings.autoStartServer) return;
    // Best-effort: if it fails (already running / port in use), we'll let Settings/Import UI surface it.
    startLiveSlidesServer(settings.serverPort).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <Router>
      <AppContent theme={theme} toggleTheme={toggleTheme} />
    </Router>
  );
}

export default App;
