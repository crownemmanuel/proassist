import React, { useState, useEffect } from "react";
import { FaDesktop, FaCheck, FaTimes, FaSpinner } from "react-icons/fa";
import {
  getEnabledConnections,
  getCurrentSlideIndex,
} from "../services/propresenterService";
import { ProPresenterActivationConfig } from "../types/propresenter";
import "../App.css";

interface ActivatePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ProPresenterActivationConfig | undefined) => void;
  currentConfig?: ProPresenterActivationConfig;
  title?: string;
}

const ActivatePresentationModal: React.FC<ActivatePresentationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  title = "Activate Presentation on ProPresenter",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedConfig, setSavedConfig] = useState<ProPresenterActivationConfig | null>(
    currentConfig || null
  );
  const [activationClicks, setActivationClicks] = useState<number>(
    currentConfig?.activationClicks ?? 1
  );
  const [takeOffClicks, setTakeOffClicks] = useState<number>(
    currentConfig?.takeOffClicks ?? 0
  );

  // Reset savedConfig when currentConfig changes
  useEffect(() => {
    setSavedConfig(currentConfig || null);
    setActivationClicks(currentConfig?.activationClicks ?? 1);
    setTakeOffClicks(currentConfig?.takeOffClicks ?? 0);
    setSuccess(false);
    setError(null);
  }, [currentConfig]);

  const handleGetSlide = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const enabledConnections = getEnabledConnections();
    if (enabledConnections.length === 0) {
      setError("No enabled ProPresenter connections found. Please enable at least one connection in Settings.");
      setIsLoading(false);
      return;
    }

    // Try each enabled connection until one succeeds
    let lastError: string | null = null;
    for (const connection of enabledConnections) {
      try {
        const slideIndexData = await getCurrentSlideIndex(connection);
        if (slideIndexData?.presentation_index) {
          const config: ProPresenterActivationConfig = {
            presentationUuid: slideIndexData.presentation_index.presentation_id.uuid,
            slideIndex: slideIndexData.presentation_index.index,
            presentationName: slideIndexData.presentation_index.presentation_id.name,
            activationClicks: activationClicks !== 1 ? activationClicks : undefined,
            takeOffClicks: takeOffClicks !== 0 ? takeOffClicks : undefined,
          };
          setSavedConfig(config);
          setSuccess(true);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to get slide index";
      }
    }

    setError(
      lastError ||
        "Failed to get slide index from any ProPresenter connection. Make sure ProPresenter is running and the slide is live."
    );
    setIsLoading(false);
  };

  const handleSave = () => {
    if (savedConfig) {
      // Include animation trigger settings in the saved config
      const configToSave: ProPresenterActivationConfig = {
        ...savedConfig,
        activationClicks: activationClicks !== 1 ? activationClicks : undefined,
        takeOffClicks: takeOffClicks !== 0 ? takeOffClicks : undefined,
      };
      onSave(configToSave);
    } else {
      onSave(undefined);
    }
    onClose();
  };

  const handleRemove = () => {
    onSave(undefined);
    onClose();
  };

  const handleCancel = () => {
    setError(null);
    setSuccess(false);
    setIsLoading(false);
    setSavedConfig(currentConfig || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "500px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <FaDesktop />
          {title}
        </h2>

        <div
          style={{
            marginBottom: "20px",
            padding: "12px",
            backgroundColor: "var(--app-header-bg)",
            borderRadius: "8px",
            border: "1px solid var(--app-border-color)",
          }}
        >
          <p style={{ margin: "0 0 12px 0", color: "var(--app-text-color)" }}>
            <strong>Instructions:</strong>
          </p>
          <ol
            style={{
              margin: "0",
              paddingLeft: "20px",
              color: "var(--app-text-color-secondary)",
            }}
          >
            <li>Go to ProPresenter and put the slide you want to activate live</li>
            <li>Click the button below to read the current slide information</li>
            <li>Save the configuration</li>
          </ol>
        </div>

        {error && (
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
            {error}
          </div>
        )}

        {success && savedConfig && (
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
                <div style={{ fontWeight: 600 }}>Slide information captured!</div>
                <div style={{ fontSize: "0.85em", marginTop: "4px", opacity: 0.9 }}>
                  Presentation: {savedConfig.presentationName || savedConfig.presentationUuid}
                  <br />
                  Slide Index: {savedConfig.slideIndex}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentConfig && !success && (
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
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>Current Configuration:</div>
            <div>
              Presentation: {currentConfig.presentationName || currentConfig.presentationUuid}
              <br />
              Slide Index: {currentConfig.slideIndex}
            </div>
          </div>
        )}

        {/* Animation Trigger Settings - Compact */}
        {savedConfig && (
          <div
            style={{
              marginBottom: "12px",
              padding: "10px",
              backgroundColor: "var(--app-header-bg)",
              border: "1px solid var(--app-border-color)",
              borderRadius: "6px",
            }}
          >
            <div style={{ fontSize: "0.85em", fontWeight: 600, marginBottom: "8px", color: "var(--app-text-color)" }}>
              Animation Triggers (optional override):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "0.8em", display: "block", marginBottom: "4px", color: "var(--app-text-color-secondary)" }}>
                  Go Live Clicks:
                </label>
                <input
                  type="number"
                  min="1"
                  value={activationClicks}
                  onChange={(e) => setActivationClicks(Math.max(1, parseInt(e.target.value) || 1))}
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
                <label style={{ fontSize: "0.8em", display: "block", marginBottom: "4px", color: "var(--app-text-color-secondary)" }}>
                  Off Live Clicks:
                </label>
                <input
                  type="number"
                  min="0"
                  value={takeOffClicks}
                  onChange={(e) => setTakeOffClicks(Math.max(0, parseInt(e.target.value) || 0))}
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
            <div style={{ fontSize: "0.75em", color: "var(--app-text-color-secondary)", marginTop: "6px" }}>
              Leave default to use template settings. Set to override for this slide only.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          {currentConfig && (
            <button onClick={handleRemove} className="secondary" style={{ marginRight: "auto" }}>
              <FaTimes />
              Remove
            </button>
          )}
          <button onClick={handleCancel} className="secondary">
            <FaTimes />
            Cancel
          </button>
          <button
            onClick={handleGetSlide}
            disabled={isLoading}
            className="secondary"
            style={{ minWidth: "140px" }}
          >
            {isLoading ? (
              <>
                <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                Reading...
              </>
            ) : (
              <>
                <FaDesktop />
                Get Slide
              </>
            )}
          </button>
          {savedConfig && (
            <button onClick={handleSave} className="primary">
              <FaCheck />
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivatePresentationModal;
