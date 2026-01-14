import React, { useEffect, useState } from "react";
import { FaDesktop, FaCheck, FaTimes, FaSpinner } from "react-icons/fa";
import {
  getLocalIp,
  getLiveSlidesServerInfo,
  loadLiveSlidesSettings,
  saveLiveSlidesSettings,
  startLiveSlidesServer,
  stopLiveSlidesServer,
} from "../services/liveSlideService";
import {
  DEFAULT_LIVE_SLIDES_SETTINGS,
  LiveSlidesProPresenterConfig,
  LiveSlidesSettings as LiveSlidesSettingsType,
} from "../types/liveSlides";
import {
  getEnabledConnections,
  getCurrentSlideIndex,
} from "../services/propresenterService";
import { ProPresenterConnection } from "../types/propresenter";
import "../App.css";

const LiveSlidesSettings: React.FC = () => {
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

  // ProPresenter activation state
  const [proPresenterConfig, setProPresenterConfig] =
    useState<LiveSlidesProPresenterConfig | null>(null);
  const [isLoadingSlide, setIsLoadingSlide] = useState(false);
  const [slideLoadError, setSlideLoadError] = useState<string | null>(null);
  const [slideLoadSuccess, setSlideLoadSuccess] = useState(false);
  const [activationClicks, setActivationClicks] = useState<number>(1);
  const [takeOffClicks, setTakeOffClicks] = useState<number>(0);
  const [clearTextFileOnTakeOff, setClearTextFileOnTakeOff] =
    useState<boolean>(true);

  // ProPresenter connection selection
  const [enabledConnections, setEnabledConnections] = useState<
    ProPresenterConnection[]
  >([]);
  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string>("");

  useEffect(() => {
    const loaded = loadLiveSlidesSettings();
    setSettings(loaded);
    if (loaded.proPresenterActivation) {
      setProPresenterConfig(loaded.proPresenterActivation);
      setActivationClicks(loaded.proPresenterActivation.activationClicks ?? 1);
      setTakeOffClicks(loaded.proPresenterActivation.takeOffClicks ?? 0);
      setClearTextFileOnTakeOff(
        loaded.proPresenterActivation.clearTextFileOnTakeOff !== false
      );
    }
    setSettingsLoaded(true);

    getLocalIp()
      .then((ip) => setLocalIp(ip))
      .catch(() => setLocalIp("Unable to determine"));

    refreshServerStatus();

    const connections = getEnabledConnections();
    setEnabledConnections(connections);
    if (connections.length > 0) {
      setSelectedConnectionId(connections[0].id);
    }
  }, []);

  // Auto-save autoStartServer setting when it changes (after initial load)
  useEffect(() => {
    if (!settingsLoaded) return;
    saveLiveSlidesSettings(settings);
  }, [settings.autoStartServer, settingsLoaded]);

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

  const handleChange = (
    field: keyof LiveSlidesSettingsType,
    value: string | number | boolean
  ) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  const handleGetSlide = async () => {
    setIsLoadingSlide(true);
    setSlideLoadError(null);
    setSlideLoadSuccess(false);

    if (enabledConnections.length === 0) {
      setSlideLoadError(
        "No enabled ProPresenter connections found. Please enable at least one connection in Settings > ProPresenter."
      );
      setIsLoadingSlide(false);
      return;
    }

    const connection =
      enabledConnections.find((c) => c.id === selectedConnectionId) ||
      enabledConnections[0];

    try {
      const slideIndexData = await getCurrentSlideIndex(connection);
      if (slideIndexData?.presentation_index) {
        const config: LiveSlidesProPresenterConfig = {
          presentationUuid: slideIndexData.presentation_index.presentation_id.uuid,
          slideIndex: slideIndexData.presentation_index.index,
          presentationName: slideIndexData.presentation_index.presentation_id.name,
          activationClicks,
          takeOffClicks,
          clearTextFileOnTakeOff,
        };
        setProPresenterConfig(config);
        setSlideLoadSuccess(true);
        setIsLoadingSlide(false);
        return;
      }
      setSlideLoadError(
        "No active presentation found. Make sure a slide is live in ProPresenter."
      );
    } catch (err) {
      setSlideLoadError(
        err instanceof Error ? err.message : "Failed to get slide index"
      );
    }

    setIsLoadingSlide(false);
  };

  const handleRemoveProPresenterConfig = () => {
    setProPresenterConfig(null);
    setSlideLoadSuccess(false);
    setSlideLoadError(null);
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage({ text: "", type: "" });

    try {
      if (settings.serverPort < 1024 || settings.serverPort > 65535) {
        throw new Error("Port must be between 1024 and 65535");
      }
      if (!settings.outputPath.trim()) {
        throw new Error("Output path is required");
      }
      if (!settings.outputFilePrefix.trim()) {
        throw new Error("Output file prefix is required");
      }

      const proPresenterActivation = proPresenterConfig
        ? {
            ...proPresenterConfig,
            activationClicks,
            takeOffClicks,
            clearTextFileOnTakeOff,
          }
        : undefined;

      saveLiveSlidesSettings({
        ...settings,
        proPresenterActivation,
      });
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
    setProPresenterConfig(null);
    setActivationClicks(1);
    setTakeOffClicks(0);
    setClearTextFileOnTakeOff(true);
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ marginBottom: "var(--spacing-4)" }}>Live Slides Settings</h2>

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

      {/* Live Slides Output Section */}
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
          Live Slides Output
        </h3>

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

      {/* ProPresenter Activation */}
      <div style={{ marginBottom: "var(--spacing-5)" }}>
        <h3
          style={{
            marginBottom: "var(--spacing-3)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FaDesktop />
          ProPresenter Activation
        </h3>
        <p
          style={{
            marginBottom: "var(--spacing-3)",
            fontSize: "0.9em",
            color: "var(--app-text-color-secondary)",
          }}
        >
          Optionally trigger a ProPresenter presentation when a live slide goes
          live or is taken off. This is useful for showing overlays or animations
          when Live Slides are active.
        </p>

        <div
          style={{
            padding: "var(--spacing-3)",
            backgroundColor: "var(--app-input-bg-color)",
            borderRadius: "8px",
            border: "1px solid var(--app-border-color)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px 0",
              color: "var(--app-text-color)",
              fontSize: "0.9em",
            }}
          >
            <strong>Instructions:</strong> Go to ProPresenter and put the slide
            you want to trigger live, then click "Get Slide".
          </p>

          {slideLoadError && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                backgroundColor: "rgba(220, 38, 38, 0.1)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: "6px",
                color: "#ef4444",
                fontSize: "0.9em",
              }}
            >
              {slideLoadError}
            </div>
          )}

          {slideLoadSuccess && proPresenterConfig && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "6px",
                color: "#22c55e",
                fontSize: "0.9em",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FaCheck />
                <div>
                  <div style={{ fontWeight: 600 }}>Slide captured!</div>
                  <div
                    style={{
                      fontSize: "0.85em",
                      marginTop: "4px",
                      opacity: 0.9,
                    }}
                  >
                    Presentation:{" "}
                    {proPresenterConfig.presentationName ||
                      proPresenterConfig.presentationUuid}
                    <br />
                    Slide Index: {proPresenterConfig.slideIndex}
                  </div>
                </div>
              </div>
            </div>
          )}

          {proPresenterConfig && !slideLoadSuccess && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                backgroundColor: "var(--app-header-bg)",
                border: "1px solid var(--app-border-color)",
                borderRadius: "6px",
                fontSize: "0.9em",
                color: "var(--app-text-color-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                Current Configuration:
              </div>
              <div>
                Presentation:{" "}
                {proPresenterConfig.presentationName ||
                  proPresenterConfig.presentationUuid}
                <br />
                Slide Index: {proPresenterConfig.slideIndex}
              </div>
            </div>
          )}

          {/* Click Settings */}
          {proPresenterConfig && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px",
                backgroundColor: "var(--app-header-bg)",
                border: "1px solid var(--app-border-color)",
                borderRadius: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "0.85em",
                  fontWeight: 600,
                  marginBottom: "8px",
                  color: "var(--app-text-color)",
                }}
              >
                Animation Trigger Settings:
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: "0.8em",
                      display: "block",
                      marginBottom: "4px",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    Go Live Clicks:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={activationClicks}
                    onChange={(e) =>
                      setActivationClicks(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "4px 6px",
                      fontSize: "0.85em",
                      backgroundColor: "var(--app-input-bg-color)",
                      color: "var(--app-input-text-color)",
                      border: "1px solid var(--app-border-color)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.8em",
                      display: "block",
                      marginBottom: "4px",
                      color: "var(--app-text-color-secondary)",
                    }}
                  >
                    Take Off Clicks:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={takeOffClicks}
                    onChange={(e) =>
                      setTakeOffClicks(
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                    style={{
                      width: "100%",
                      padding: "4px 6px",
                      fontSize: "0.85em",
                      backgroundColor: "var(--app-input-bg-color)",
                      color: "var(--app-input-text-color)",
                      border: "1px solid var(--app-border-color)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.75em",
                  color: "var(--app-text-color-secondary)",
                  marginTop: "6px",
                }}
              >
                Use multiple clicks to trigger ProPresenter animations. "Go Live
                Clicks" triggers when a live slide is set live. "Take Off Clicks"
                triggers when taking off the live slide.
              </div>

              {/* Clear Text File on Take Off Option */}
              <div
                style={{
                  marginTop: "var(--spacing-3)",
                  paddingTop: "var(--spacing-3)",
                  borderTop: "1px solid var(--app-border-color)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}
                >
                  <input
                    type="checkbox"
                    id="clearLiveSlidesTextOnTakeOff"
                    checked={clearTextFileOnTakeOff}
                    onChange={(e) => setClearTextFileOnTakeOff(e.target.checked)}
                    style={{ width: "auto", margin: 0 }}
                  />
                  <label
                    htmlFor="clearLiveSlidesTextOnTakeOff"
                    style={{
                      margin: 0,
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: "0.9em",
                    }}
                  >
                    Clear text files when taking off live
                  </label>
                </div>
                <div
                  style={{
                    fontSize: "0.75em",
                    color: "var(--app-text-color-secondary)",
                    marginTop: "4px",
                    marginLeft: "24px",
                  }}
                >
                  If unchecked, the Live Slides output files will remain
                  unchanged when taking off. Only the ProPresenter slide will be
                  triggered.
                </div>
              </div>
            </div>
          )}

          {/* ProPresenter Connection Selector */}
          {enabledConnections.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  fontSize: "0.85em",
                  display: "block",
                  marginBottom: "6px",
                  color: "var(--app-text-color-secondary)",
                  fontWeight: 600,
                }}
              >
                Get slide from:
              </label>
              {enabledConnections.length === 1 ? (
                <div
                  style={{
                    padding: "6px 8px",
                    fontSize: "0.9em",
                    backgroundColor: "var(--app-input-bg-color)",
                    color: "var(--app-input-text-color)",
                    border: "1px solid var(--app-border-color)",
                    borderRadius: "4px",
                  }}
                >
                  {enabledConnections[0].name} ({enabledConnections[0].apiUrl})
                </div>
              ) : (
                <select
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "0.9em",
                    backgroundColor: "var(--app-input-bg-color)",
                    color: "var(--app-input-text-color)",
                    border: "1px solid var(--app-border-color)",
                    borderRadius: "4px",
                  }}
                >
                  {enabledConnections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.apiUrl})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleGetSlide}
              disabled={isLoadingSlide || enabledConnections.length === 0}
              className="secondary"
              style={{ minWidth: "140px" }}
            >
              {isLoadingSlide ? (
                <>
                  <FaSpinner
                    style={{ animation: "spin 1s linear infinite", marginRight: "6px" }}
                  />
                  Reading...
                </>
              ) : (
                <>
                  <FaDesktop style={{ marginRight: "6px" }} />
                  Get Slide
                </>
              )}
            </button>
            {proPresenterConfig && (
              <button onClick={handleRemoveProPresenterConfig} className="secondary">
                <FaTimes style={{ marginRight: "6px" }} />
                Remove
              </button>
            )}
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

export default LiveSlidesSettings;
