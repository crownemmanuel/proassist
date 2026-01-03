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

// Navigation component that uses useLocation
function Navigation({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const location = useLocation();
  
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

function App() {
  const [theme, setTheme] = useState(
    localStorage.getItem("app-theme") || "dark"
  );

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
      <div className="container">
        <Navigation theme={theme} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<MainApplicationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/live-testimonies" element={<MediaView />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
