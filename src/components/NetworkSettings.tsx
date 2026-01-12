import React, { useState, useEffect } from "react";
import {
  loadLiveSlidesSettings,
  saveLiveSlidesSettings,
  getLocalIp,
  getLiveSlidesServerInfo,
  startLiveSlidesServer,
  stopLiveSlidesServer,
} from "../services/liveSlideService";
import {
  LiveSlidesSettings as LiveSlidesSettingsType,
  DEFAULT_LIVE_SLIDES_SETTINGS,
} from "../types/liveSlides";
import "../App.css";

const NetworkSettings: React.FC = () => {
  const [settings, setSettings] = useState<LiveSlidesSettingsType>(
    DEFAULT_LIVE_SLIDES_SETTINGS
  );
  const [localIp, setLocalIp] = useState<string>("Loading...");
  const [serverRunning, setServerRunning] = useState<boolean>(false);
  const [serverStatusText, setServerStatusText] = useState<string>("");
  const [isTogglingServer, setIsTogglingServer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    // Load settings
    setSettings(loadLiveSlidesSettings());
    setSettingsLoaded(true);

    // Get local IP
    getLocalIp()
      .then((ip) => setLocalIp(ip))
      .catch(() => setLocalIp("Unable to determine"));

    // Fetch server status (best-effort)
    getLiveSlidesServerInfo()
      .then((info) => {
        setServerRunning(info.server_running);
        setServerStatusText(
          info.server_running
            ? `${info.local_ip}:${info.server_port}`
            : "Stopped"
        );
      })
      .catch(() => {
        setServerRunning(false);
        setServerStatusText("Stopped");
      });
  }, []);

  // Auto-save autoStartServer setting when it changes (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
    saveLiveSlidesSettings(settings);
  }, [settings.autoStartServer, settingsLoaded]);

  const handleChange = (
    field: keyof LiveSlidesSettingsType,
    value: string | number | boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage({ text: "", type: "" });

    try {
      // Validate port
      if (settings.serverPort < 1024 || settings.serverPort > 65535) {
        throw new Error("Port must be between 1024 and 65535");
      }

      // Validate output path
      if (!settings.outputPath.trim()) {
        throw new Error("Output path is required");
      }

      // Validate file prefix
      if (!settings.outputFilePrefix.trim()) {
        throw new Error("Output file prefix is required");
      }

      saveLiveSlidesSettings(settings);
      setSaveMessage({ text: "Settings saved successfully", type: "success" });
      setTimeout(() => setSaveMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings";
      setSaveMessage({ text: message, type: "error" });
      setTimeout(() => setSaveMessage({ text: "", type: "" }), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_LIVE_SLIDES_SETTINGS);
  };

  const refreshServerStatus = async () => {
    try {
      const info = await getLiveSlidesServerInfo();
      setServerRunning(info.server_running);
      setServerStatusText(
        info.server_running ? `${info.local_ip}:${info.server_port}` : "Stopped"
      );
    } catch {
      setServerRunning(false);
      setServerStatusText("Stopped");
    }
  };

  const handleToggleServer = async () => {
    setIsTogglingServer(true);
    setSaveMessage({ text: "", type: "" });
    try {
      if (serverRunning) {
        await stopLiveSlidesServer();
      } else {
        await startLiveSlidesServer(settings.serverPort);
      }
      await refreshServerStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSaveMessage({ text: `Server action failed: ${msg}`, type: "error" });
      setTimeout(() => setSaveMessage({ text: "", type: "" }), 5000);
    } finally {
      setIsTogglingServer(false);
    }
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ marginBottom: "var(--spacing-4)" }}>Network Settings</h2>

      {/* Web Server Settings Section */}
      <div
        style={{
          marginBottom: "var(--spacing-5)",
          padding: "var(--spacing-4)",
          backgroundColor: "var(--app-header-bg)",
          borderRadius: "12px",
          border: "1px solid var(--app-border-color)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "var(--spacing-4)",
            fontSize: "1.25rem",
            fontWeight: 600,
          }}
        >
          Web Server Settings
        </h3>

        {/* Network Information */}
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Network Information
          </h4>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "8px",
              border: "1px solid var(--app-border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 500 }}>Local IP Address:</span>
              <span
                style={{
                  fontFamily: "monospace",
                  padding: "4px 12px",
                  backgroundColor: "var(--app-bg-color)",
                  borderRadius: "4px",
                }}
              >
                {localIp}
              </span>
            </div>
            <p
              style={{
                margin: "var(--spacing-2) 0 0 0",
                fontSize: "0.85em",
                color: "var(--app-text-color-secondary)",
              }}
            >
              Other devices on your local network can connect using this IP
              address.
            </p>
          </div>
        </div>

        {/* Server Control */}
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Server Status
          </h4>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "8px",
              border: "1px solid var(--app-border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--spacing-3)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                Status:{" "}
                <span style={{ color: serverRunning ? "#22c55e" : "#9ca3af" }}>
                  {serverRunning ? "Running" : "Stopped"}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.9em",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                {serverStatusText}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
              <button
                onClick={handleToggleServer}
                disabled={isTogglingServer}
                className={serverRunning ? "secondary" : "primary"}
                style={{ minWidth: "140px" }}
              >
                {serverRunning
                  ? isTogglingServer
                    ? "Stopping..."
                    : "Stop Server"
                  : isTogglingServer
                  ? "Starting..."
                  : "Start Server"}
              </button>
              <button
                onClick={refreshServerStatus}
                disabled={isTogglingServer}
                className="secondary"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Server Configuration */}
        <div>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Server Configuration
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-3)",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--spacing-1)",
                  fontWeight: 500,
                }}
              >
                Server Port
              </label>
              <input
                type="number"
                value={settings.serverPort}
                onChange={(e) =>
                  handleChange("serverPort", parseInt(e.target.value, 10) || 9876)
                }
                min={1024}
                max={65535}
                style={{ width: "150px", padding: "var(--spacing-2)" }}
              />
              <p
                style={{
                  marginTop: "var(--spacing-1)",
                  fontSize: "0.85em",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Port for the web server (default: 9876). Must be between 1024
                and 65535. This server handles both HTTP and WebSocket
                connections.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-2)",
                padding: "var(--spacing-3)",
                backgroundColor: "var(--app-bg-color)",
                borderRadius: "8px",
              }}
            >
              <input
                type="checkbox"
                id="autoStartServer"
                checked={settings.autoStartServer}
                onChange={(e) =>
                  handleChange("autoStartServer", e.target.checked)
                }
                style={{ width: "auto", margin: 0 }}
              />
              <label
                htmlFor="autoStartServer"
                style={{ margin: 0, cursor: "pointer", fontWeight: 500 }}
              >
                Auto-start server when app opens
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Live Slides Section */}
      <div
        style={{
          marginBottom: "var(--spacing-5)",
          padding: "var(--spacing-4)",
          backgroundColor: "var(--app-header-bg)",
          borderRadius: "12px",
          border: "1px solid var(--app-border-color)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "var(--spacing-3)",
            fontSize: "1.25rem",
            fontWeight: 600,
          }}
        >
          Live Slides
        </h3>

        {/* Info Box */}
        <div
          style={{
            marginBottom: "var(--spacing-4)",
            padding: "var(--spacing-3)",
            backgroundColor: "var(--app-input-bg-color)",
            borderRadius: "8px",
            border: "1px solid var(--app-border-color)",
          }}
        >
          <p style={{ margin: "0 0 var(--spacing-2) 0", fontWeight: 500 }}>
            About Live Slides
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.9em",
              color: "var(--app-text-color-secondary)",
            }}
          >
            Live Slides allows you to type slides in real-time from any device on
            your network. Start the web server, create a session, and share the
            URL with anyone who needs to input slides.
          </p>
        </div>

        {/* Output Configuration */}
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Output Configuration
          </h4>
          <p
            style={{
              marginBottom: "var(--spacing-3)",
              fontSize: "0.9em",
              color: "var(--app-text-color-secondary)",
            }}
          >
            Configure where live slide content will be written when a slide is
            made live.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-3)",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--spacing-1)",
                  fontWeight: 500,
                }}
              >
                Output Path
              </label>
              <input
                type="text"
                value={settings.outputPath}
                onChange={(e) => handleChange("outputPath", e.target.value)}
                placeholder="/tmp/proassist/live_slides/"
                style={{ width: "100%", padding: "var(--spacing-2)" }}
              />
              <p
                style={{
                  marginTop: "var(--spacing-1)",
                  fontSize: "0.85em",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Directory where live slide files will be written
              </p>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--spacing-1)",
                  fontWeight: 500,
                }}
              >
                Output File Prefix
              </label>
              <input
                type="text"
                value={settings.outputFilePrefix}
                onChange={(e) => handleChange("outputFilePrefix", e.target.value)}
                placeholder="live_slide_"
                style={{ width: "300px", padding: "var(--spacing-2)" }}
              />
              <p
                style={{
                  marginTop: "var(--spacing-1)",
                  fontSize: "0.85em",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Prefix for output files (e.g., "live_slide_" → "live_slide_1.txt")
              </p>
            </div>
          </div>
        </div>

        {/* Example Output */}
        <div>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Example Output
          </h4>
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "0.85em",
            }}
          >
            <div style={{ color: "var(--app-text-color-secondary)" }}>
              {settings.outputPath}
              {settings.outputFilePrefix}1.txt
            </div>
            <div style={{ color: "var(--app-text-color-secondary)" }}>
              {settings.outputPath}
              {settings.outputFilePrefix}2.txt
            </div>
            <div style={{ color: "var(--app-text-color-secondary)" }}>...</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-2)",
        }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="primary"
          style={{ minWidth: "120px" }}
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
        <button onClick={handleReset} className="secondary">
          Reset to Defaults
        </button>
        {saveMessage.text && (
          <span
            style={{
              marginLeft: "var(--spacing-2)",
              color: saveMessage.type === "success" ? "#22c55e" : "#dc2626",
              fontSize: "0.9em",
            }}
          >
            {saveMessage.text}
          </span>
        )}
      </div>
    </div>
  );
};

export default NetworkSettings;
