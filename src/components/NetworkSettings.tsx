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
import {
  NetworkSyncSettings,
  NetworkSyncMode,
  DEFAULT_NETWORK_SYNC_SETTINGS,
} from "../types/networkSync";
import {
  loadNetworkSyncSettings,
  saveNetworkSyncSettings,
  startSyncServer,
  stopSyncServer,
  getSyncServerInfo,
} from "../services/networkSyncService";
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

  // Network Sync state
  const [syncSettings, setSyncSettings] = useState<NetworkSyncSettings>(
    DEFAULT_NETWORK_SYNC_SETTINGS
  );
  const [syncServerRunning, setSyncServerRunning] = useState(false);
  const [syncConnectedClients, setSyncConnectedClients] = useState(0);
  const [isTogglingSyncServer, setIsTogglingSyncServer] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{
    text: string;
    type: "success" | "error" | "";
  }>({ text: "", type: "" });

  useEffect(() => {
    // Load settings
    setSettings(loadLiveSlidesSettings());
    setSyncSettings(loadNetworkSyncSettings());
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

    // Fetch sync server status
    refreshSyncServerStatus();
  }, []);

  // Periodically refresh sync server status
  useEffect(() => {
    const interval = setInterval(refreshSyncServerStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshSyncServerStatus = async () => {
    try {
      const info = await getSyncServerInfo();
      setSyncServerRunning(info.running);
      setSyncConnectedClients(info.connected_clients);
    } catch {
      setSyncServerRunning(false);
      setSyncConnectedClients(0);
    }
  };

  const handleSyncSettingChange = (
    field: keyof NetworkSyncSettings,
    value: string | number | boolean
  ) => {
    setSyncSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSyncModeChange = (mode: NetworkSyncMode) => {
    setSyncSettings((prev) => ({
      ...prev,
      mode,
    }));
  };

  const handleToggleSyncServer = async () => {
    setIsTogglingSyncServer(true);
    setSyncMessage({ text: "", type: "" });
    
    try {
      if (syncServerRunning) {
        await stopSyncServer();
        setSyncMessage({ text: "Sync server stopped", type: "success" });
      } else {
        // Validate settings before starting
        if (syncSettings.mode === "off") {
          throw new Error("Please select a sync mode first");
        }
        if ((syncSettings.mode === "slave" || syncSettings.mode === "peer") && !syncSettings.remoteHost) {
          throw new Error("Remote host IP is required for slave/peer mode");
        }
        
        // Save settings before starting
        saveNetworkSyncSettings(syncSettings);
        
        await startSyncServer(syncSettings.serverPort, syncSettings.mode);
        setSyncMessage({ text: "Sync server started", type: "success" });
      }
      await refreshSyncServerStatus();
      setTimeout(() => setSyncMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSyncMessage({ text: msg, type: "error" });
      setTimeout(() => setSyncMessage({ text: "", type: "" }), 5000);
    } finally {
      setIsTogglingSyncServer(false);
    }
  };

  const handleSaveSyncSettings = () => {
    try {
      // Validate port
      if (syncSettings.serverPort < 1024 || syncSettings.serverPort > 65535) {
        throw new Error("Port must be between 1024 and 65535");
      }
      
      // Validate remote host for slave/peer mode
      if ((syncSettings.mode === "slave" || syncSettings.mode === "peer") && !syncSettings.remoteHost.trim()) {
        throw new Error("Remote host is required for slave/peer mode");
      }
      
      saveNetworkSyncSettings(syncSettings);
      setSyncMessage({ text: "Sync settings saved", type: "success" });
      setTimeout(() => setSyncMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setSyncMessage({ text: msg, type: "error" });
      setTimeout(() => setSyncMessage({ text: "", type: "" }), 5000);
    }
  };

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

      {/* Network Sync Section */}
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
          Network Sync
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
            About Network Sync
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.9em",
              color: "var(--app-text-color-secondary)",
            }}
          >
            Network Sync allows multiple ProAssist instances to share data. In Master mode,
            this device broadcasts changes to others. In Slave mode, it receives updates from
            a master. In Peer mode, all devices sync bidirectionally.
          </p>
        </div>

        {/* Sync Mode Selection */}
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
            Sync Mode
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--spacing-2)",
            }}
          >
            {[
              { value: "off", label: "Off", desc: "Sync disabled" },
              { value: "master", label: "Master", desc: "Broadcast only" },
              { value: "slave", label: "Slave", desc: "Receive only" },
              { value: "peer", label: "Peer", desc: "Both directions" },
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => handleSyncModeChange(mode.value as NetworkSyncMode)}
                disabled={syncServerRunning}
                style={{
                  padding: "var(--spacing-3)",
                  backgroundColor:
                    syncSettings.mode === mode.value
                      ? "var(--app-primary-color)"
                      : "var(--app-input-bg-color)",
                  color:
                    syncSettings.mode === mode.value
                      ? "white"
                      : "var(--app-text-color)",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "8px",
                  cursor: syncServerRunning ? "not-allowed" : "pointer",
                  opacity: syncServerRunning ? 0.7 : 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontWeight: 600 }}>{mode.label}</span>
                <span
                  style={{
                    fontSize: "0.75em",
                    opacity: 0.8,
                  }}
                >
                  {mode.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sync Server Status */}
        {syncSettings.mode !== "off" && (
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
              Sync Server Status
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
                  <span style={{ color: syncServerRunning ? "#22c55e" : "#9ca3af" }}>
                    {syncServerRunning ? "Running" : "Stopped"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.9em",
                    color: "var(--app-text-color-secondary)",
                  }}
                >
                  {syncServerRunning
                    ? `${localIp}:${syncSettings.serverPort} • ${syncConnectedClients} client${syncConnectedClients !== 1 ? "s" : ""} connected`
                    : "Not running"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
                <button
                  onClick={handleToggleSyncServer}
                  disabled={isTogglingSyncServer}
                  className={syncServerRunning ? "secondary" : "primary"}
                  style={{ minWidth: "140px" }}
                >
                  {syncServerRunning
                    ? isTogglingSyncServer
                      ? "Stopping..."
                      : "Stop Sync"
                    : isTogglingSyncServer
                    ? "Starting..."
                    : "Start Sync"}
                </button>
                <button
                  onClick={refreshSyncServerStatus}
                  disabled={isTogglingSyncServer}
                  className="secondary"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Settings (for slave/peer) */}
        {(syncSettings.mode === "slave" || syncSettings.mode === "peer") && (
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
              Remote Connection
            </h4>
            <p
              style={{
                marginBottom: "var(--spacing-3)",
                fontSize: "0.9em",
                color: "var(--app-text-color-secondary)",
              }}
            >
              Enter the IP address and port of the {syncSettings.mode === "slave" ? "master" : "peer"} device to connect to.
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--spacing-3)",
                alignItems: "flex-end",
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "var(--spacing-1)",
                    fontWeight: 500,
                  }}
                >
                  Remote Host IP
                </label>
                <input
                  type="text"
                  value={syncSettings.remoteHost}
                  onChange={(e) => handleSyncSettingChange("remoteHost", e.target.value)}
                  placeholder="192.168.1.100"
                  disabled={syncServerRunning}
                  style={{ width: "100%", padding: "var(--spacing-2)" }}
                />
              </div>
              <div style={{ width: "120px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "var(--spacing-1)",
                    fontWeight: 500,
                  }}
                >
                  Remote Port
                </label>
                <input
                  type="number"
                  value={syncSettings.remotePort}
                  onChange={(e) =>
                    handleSyncSettingChange("remotePort", parseInt(e.target.value, 10) || 9877)
                  }
                  min={1024}
                  max={65535}
                  disabled={syncServerRunning}
                  style={{ width: "100%", padding: "var(--spacing-2)" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Sync Port Configuration */}
        {syncSettings.mode !== "off" && (
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
              Server Configuration
            </h4>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "var(--spacing-1)",
                  fontWeight: 500,
                }}
              >
                Local Sync Port
              </label>
              <input
                type="number"
                value={syncSettings.serverPort}
                onChange={(e) =>
                  handleSyncSettingChange("serverPort", parseInt(e.target.value, 10) || 9877)
                }
                min={1024}
                max={65535}
                disabled={syncServerRunning}
                style={{ width: "150px", padding: "var(--spacing-2)" }}
              />
              <p
                style={{
                  marginTop: "var(--spacing-1)",
                  fontSize: "0.85em",
                  color: "var(--app-text-color-secondary)",
                }}
              >
                Port for the sync server (default: 9877). Must be different from the web server port.
              </p>
            </div>
          </div>
        )}

        {/* What to Sync */}
        {syncSettings.mode !== "off" && (
          <div style={{ marginBottom: "var(--spacing-4)" }}>
            <h4 style={{ marginBottom: "var(--spacing-2)", fontSize: "1rem" }}>
              What to Sync
            </h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-2)",
                  padding: "var(--spacing-2)",
                  backgroundColor: "var(--app-bg-color)",
                  borderRadius: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id="syncPlaylists"
                  checked={syncSettings.syncPlaylists}
                  onChange={(e) => handleSyncSettingChange("syncPlaylists", e.target.checked)}
                  disabled={syncServerRunning}
                  style={{ width: "auto", margin: 0 }}
                />
                <label
                  htmlFor="syncPlaylists"
                  style={{ margin: 0, cursor: "pointer", flex: 1 }}
                >
                  <span style={{ fontWeight: 500 }}>Playlist Items</span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.85em",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    Sync slides when they are created or updated (excludes Live Slides)
                  </span>
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-2)",
                  padding: "var(--spacing-2)",
                  backgroundColor: "var(--app-bg-color)",
                  borderRadius: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id="syncSchedule"
                  checked={syncSettings.syncSchedule}
                  onChange={(e) => handleSyncSettingChange("syncSchedule", e.target.checked)}
                  disabled={syncServerRunning}
                  style={{ width: "auto", margin: 0 }}
                />
                <label
                  htmlFor="syncSchedule"
                  style={{ margin: 0, cursor: "pointer", flex: 1 }}
                >
                  <span style={{ fontWeight: 500 }}>Timer Schedule</span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.85em",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    Sync the session schedule when it changes
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Auto-connect */}
        {syncSettings.mode !== "off" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-2)",
              padding: "var(--spacing-3)",
              backgroundColor: "var(--app-bg-color)",
              borderRadius: "8px",
              marginBottom: "var(--spacing-4)",
            }}
          >
            <input
              type="checkbox"
              id="autoConnectSync"
              checked={syncSettings.autoConnect}
              onChange={(e) => handleSyncSettingChange("autoConnect", e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            <label
              htmlFor="autoConnectSync"
              style={{ margin: 0, cursor: "pointer", fontWeight: 500 }}
            >
              Auto-start sync when app opens
            </label>
          </div>
        )}

        {/* Sync Actions */}
        {syncSettings.mode !== "off" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-2)",
            }}
          >
            <button
              onClick={handleSaveSyncSettings}
              disabled={syncServerRunning}
              className="primary"
              style={{ minWidth: "120px" }}
            >
              Save Sync Settings
            </button>
            {syncMessage.text && (
              <span
                style={{
                  marginLeft: "var(--spacing-2)",
                  color: syncMessage.type === "success" ? "#22c55e" : "#dc2626",
                  fontSize: "0.9em",
                }}
              >
                {syncMessage.text}
              </span>
            )}
          </div>
        )}
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
