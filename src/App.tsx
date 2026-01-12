import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  FaHome,
  FaCog,
  FaQuestionCircle,
  FaSun,
  FaMoon,
  FaMicrophone,
  FaClock,
} from "react-icons/fa";
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
import StageAssistPage from "./pages/StageAssistPage";
import {
  StageAssistProvider,
  useStageAssist,
  formatStageAssistTime,
} from "./contexts/StageAssistContext";
import {
  loadLiveSlidesSettings,
  startLiveSlidesServer,
} from "./services/liveSlideService";
import UpdateNotification from "./components/UpdateNotification";

// Navigation component that uses useLocation
function Navigation({
  theme,
  toggleTheme,
}: {
  theme: string;
  toggleTheme: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { timerState, getNextSession, goNextSession } = useStageAssist();
  const nextSession = getNextSession();

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
      <Link
        to="/"
        className={`nav-action-button ${isActive("/") ? "active" : ""}`}
      >
        <FaHome />
        <span>Main</span>
      </Link>
      <Link
        to="/stage-assist"
        className={`nav-action-button ${
          isActive("/stage-assist") ? "active" : ""
        }`}
      >
        <FaClock />
        <span>Timer</span>
      </Link>
      <Link
        to="/live-testimonies"
        className={`nav-action-button ${
          isActive("/live-testimonies") ? "active" : ""
        }`}
      >
        <FaMicrophone />
        <span>Live Testimonies</span>
      </Link>
      <Link
        to="/settings"
        className={`nav-action-button ${isActive("/settings") ? "active" : ""}`}
      >
        <FaCog />
        <span>Settings</span>
      </Link>
      <Link
        to="/help"
        className={`nav-action-button ${isActive("/help") ? "active" : ""}`}
      >
        <FaQuestionCircle />
        <span>Help</span>
      </Link>

      {timerState.isRunning && (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          title="Current countdown"
        >
          <button
            onClick={() => navigate("/stage-assist")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {timerState.sessionName || "Timer"}:{" "}
              {formatStageAssistTime(timerState.timeLeft)}
            </span>
            {nextSession && (
              <span
                style={{
                  opacity: 0.8,
                  fontSize: "0.85em",
                  whiteSpace: "nowrap",
                }}
              >
                Next: {nextSession.session}
              </span>
            )}
          </button>
          <button
            onClick={async () => {
              const didGo = await goNextSession();
              if (didGo) navigate("/stage-assist");
            }}
            disabled={!nextSession}
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.18)",
              background: nextSession
                ? "rgba(34,197,94,0.18)"
                : "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: nextSession ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
            title={nextSession ? "Start next session timer" : "No next session"}
          >
            Go Next
          </button>
        </div>
      )}

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
function AppContent({
  theme,
  toggleTheme,
}: {
  theme: string;
  toggleTheme: () => void;
}) {
  const location = useLocation();
  const isNotepadPage = location.pathname.includes("/live-slides/notepad/");

  if (isNotepadPage) {
    // Notepad page gets full viewport without navigation
    return (
      <Routes>
        <Route
          path="/live-slides/notepad/:sessionId"
          element={<LiveSlidesNotepad />}
        />
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
        <Route path="/stage-assist" element={<StageAssistPage />} />
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
      <StageAssistProvider>
        <AppContent theme={theme} toggleTheme={toggleTheme} />
        <UpdateNotification />
      </StageAssistProvider>
    </Router>
  );
}

export default App;
