import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
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

  // const [greetMsg, setGreetMsg] = useState("");
  // const [name, setName] = useState("");

  // async function greet() {
  //   // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  //   setGreetMsg(await invoke("greet", { name }));
  // }

  // Example update check (can be re-added later if needed)
  // useEffect(() => {
  //   const doUpdateCheck = async () => {
  //     try {
  //       console.log('Checking for updates...');
  //       const { shouldUpdate, manifest } = await checkUpdate();
  //       if (shouldUpdate) {
  //         console.log(
  //           `Installing update ${manifest?.version}, current version is ${await getName()} ${await getVersion()}`
  //         );
  //         // Install the update. This will also restart the app on Windows!
  //         await installUpdate();
  //         // On macOS and Linux you will need to restart the app manually.
  //         // You could use this step to display confirmation dialog.
  //         await relaunch();
  //       }
  //     } catch (error) {
  //       console.error('Update check failed:', error);
  //     }
  //   };
  //   doUpdateCheck();
  // }, []);

  return (
    <Router>
      <div className="container">
        <nav className="app-nav">
          <Link to="/" className="nav-action-button">
            <FaHome />
            <span>Main</span>
          </Link>
          <Link to="/settings" className="nav-action-button">
            <FaCog />
            <span>Settings</span>
          </Link>
          <Link to="/live-testimonies" className="nav-action-button">
            <FaMicrophone />
            <span>Live Testimonies</span>
          </Link>
          <Link to="/help" className="nav-action-button">
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
