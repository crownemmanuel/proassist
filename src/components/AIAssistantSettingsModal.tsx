import React, { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import "../App.css";

const AI_ASSISTANT_SETTINGS_KEY = "proassist-ai-assistant-settings";

interface AIAssistantSettings {
  customSystemPrompt?: string;
  autoPromptForImages?: string;
}

interface AIAssistantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistantSettingsModal: React.FC<AIAssistantSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [autoPromptForImages, setAutoPromptForImages] = useState("");

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(AI_ASSISTANT_SETTINGS_KEY);
        if (stored) {
          const settings: AIAssistantSettings = JSON.parse(stored);
          setCustomSystemPrompt(settings.customSystemPrompt || "");
          setAutoPromptForImages(settings.autoPromptForImages || "");
        }
      } catch (error) {
        console.error("Failed to load AI Assistant settings:", error);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    try {
      const settings: AIAssistantSettings = {
        customSystemPrompt: customSystemPrompt.trim() || undefined,
        autoPromptForImages: autoPromptForImages.trim() || undefined,
      };
      localStorage.setItem(AI_ASSISTANT_SETTINGS_KEY, JSON.stringify(settings));
      onClose();
    } catch (error) {
      console.error("Failed to save AI Assistant settings:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-content"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", maxHeight: "80vh" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--spacing-4)",
          }}
        >
          <h2 style={{ margin: 0 }}>AI Assistant Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--app-text-color)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <FaTimes />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-4)" }}>
          {/* Custom System Prompt */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "var(--spacing-2)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Custom System Prompt
            </label>
            <p
              style={{
                margin: "0 0 var(--spacing-2) 0",
                fontSize: "0.75rem",
                color: "var(--app-text-color-secondary)",
              }}
            >
              Additional instructions that will be added to the system prompt for all AI requests.
              This helps customize the AI's behavior for your specific needs.
            </p>
            <textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="e.g., Always format times in 12-hour format with AM/PM. Include minister names when available."
              style={{
                width: "100%",
                minHeight: "120px",
                padding: "var(--spacing-2)",
                borderRadius: "6px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-input-bg-color)",
                color: "var(--app-input-text-color)",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
          </div>

          {/* Auto Prompt for Images */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "var(--spacing-2)",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Auto Prompt for Images
            </label>
            <p
              style={{
                margin: "0 0 var(--spacing-2) 0",
                fontSize: "0.75rem",
                color: "var(--app-text-color-secondary)",
              }}
            >
              This text will automatically be added to the input field when an image is attached.
              Leave empty to use the default prompt.
            </p>
            <textarea
              value={autoPromptForImages}
              onChange={(e) => setAutoPromptForImages(e.target.value)}
              placeholder="e.g., Create the schedule based on the provided image. If a time does not specify AM or PM, use the current time period."
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "var(--spacing-2)",
                borderRadius: "6px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-input-bg-color)",
                color: "var(--app-input-text-color)",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: "var(--spacing-4)" }}>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantSettingsModal;

// Export function to get settings
export function getAIAssistantSettings(): AIAssistantSettings {
  try {
    const stored = localStorage.getItem(AI_ASSISTANT_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load AI Assistant settings:", error);
  }
  return {};
}
