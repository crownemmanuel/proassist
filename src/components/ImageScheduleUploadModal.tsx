import React, { useState, useRef, useCallback, useEffect } from "react";
import { FaTimes, FaCog, FaUpload, FaClipboard, FaSpinner } from "react-icons/fa";
import { ScheduleItem } from "../types/propresenter";
import { parseScheduleFromImage } from "../services/scheduleAIService";
import { findMatchingAutomation } from "../utils/testimoniesStorage";
import "../App.css";

// Storage key for image upload AI settings
const IMAGE_AI_SETTINGS_KEY = "proassist-image-ai-settings";

interface ImageAISettings {
  systemPrompt: string;
}

const DEFAULT_SYSTEM_PROMPT = `Create the schedule based on the provided image. If a time does not specify AM or PM on the schedule, use {{default_time_of_day}}.`;

function getImageAISettings(): ImageAISettings {
  try {
    const stored = localStorage.getItem(IMAGE_AI_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load image AI settings:", error);
  }
  return { systemPrompt: DEFAULT_SYSTEM_PROMPT };
}

function saveImageAISettings(settings: ImageAISettings): void {
  try {
    localStorage.setItem(IMAGE_AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save image AI settings:", error);
  }
}

interface ImageScheduleUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleLoad: (schedule: ScheduleItem[]) => void;
}

const ImageScheduleUploadModal: React.FC<ImageScheduleUploadModalProps> = ({
  isOpen,
  onClose,
  onScheduleLoad,
}) => {
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      const settings = getImageAISettings();
      setSystemPrompt(settings.systemPrompt);
      setAttachedImage(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Process a file (image)
  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!isOpen) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          processFile(file);
        }
      }
    }
  }, [isOpen]);

  // Set up paste listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Save settings
  const handleSaveSettings = () => {
    saveImageAISettings({ systemPrompt });
    setShowSettings(false);
  };

  // Process the image
  const handleProcess = async () => {
    if (!attachedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Replace placeholder with actual time period
      const currentPeriod = new Date().getHours() >= 12 ? "PM" : "AM";
      const finalPrompt = systemPrompt.replace(
        /\{\{default_time_of_day\}\}/gi,
        currentPeriod
      );

      const response = await parseScheduleFromImage(attachedImage, finalPrompt);

      if (response.action === "UpdateSchedule" && Array.isArray(response.actionValue)) {
        // Apply smart automations to the schedule items
        const scheduleWithAutomations = response.actionValue.map((item: ScheduleItem) => {
          const matchingAutomations = findMatchingAutomation(item.session);
          if (matchingAutomations && matchingAutomations.length > 0) {
            return { ...item, automations: matchingAutomations };
          }
          return item;
        });

        onScheduleLoad(scheduleWithAutomations);
        onClose();
      } else if (response.responseText) {
        setError(response.responseText);
      } else {
        setError("Failed to parse schedule from image. Please try again.");
      }
    } catch (err) {
      console.error("Error processing image:", err);
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-content"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "550px", maxHeight: "85vh", overflow: "auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--spacing-4)",
          }}
        >
          <h2 style={{ margin: 0 }}>Load Schedule from Image</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                background: showSettings ? "var(--app-primary-color)" : "none",
                border: "none",
                color: showSettings ? "#fff" : "var(--app-text-color)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
              }}
              title="AI Settings"
            >
              <FaCog />
            </button>
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
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div
            style={{
              backgroundColor: "var(--app-header-bg)",
              padding: "var(--spacing-4)",
              borderRadius: "8px",
              marginBottom: "var(--spacing-4)",
              border: "1px solid var(--app-border-color)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "var(--spacing-2)" }}>
              AI Processing Settings
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--app-text-color-secondary)",
                marginBottom: "var(--spacing-3)",
              }}
            >
              Customize the prompt sent to the AI when processing schedule images.
              Use <code>{"{{default_time_of_day}}"}</code> to auto-insert AM/PM based on current time.
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter custom prompt for AI..."
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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "var(--spacing-3)" }}>
              <button
                onClick={() => {
                  setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "4px",
                  color: "var(--app-text-color)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Reset to Default
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "var(--app-primary-color)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: "6px",
              color: "rgb(220, 38, 38)",
              marginBottom: "var(--spacing-4)",
            }}
          >
            {error}
          </div>
        )}

        {/* Drop zone / Image preview */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !attachedImage && fileInputRef.current?.click()}
          style={{
            border: isDragOver
              ? "2px dashed var(--app-primary-color)"
              : "2px dashed var(--app-border-color)",
            borderRadius: "12px",
            padding: attachedImage ? "var(--spacing-3)" : "var(--spacing-6)",
            textAlign: "center",
            backgroundColor: isDragOver
              ? "rgba(59, 130, 246, 0.1)"
              : "rgba(255, 255, 255, 0.02)",
            cursor: attachedImage ? "default" : "pointer",
            transition: "all 0.2s ease",
            minHeight: "200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {attachedImage ? (
            <div style={{ position: "relative", width: "100%" }}>
              <img
                src={attachedImage}
                alt="Schedule preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "300px",
                  borderRadius: "8px",
                  objectFit: "contain",
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAttachedImage(null);
                }}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  padding: "6px",
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Remove image"
              >
                <FaTimes size={12} />
              </button>
            </div>
          ) : (
            <>
              <FaUpload
                style={{
                  fontSize: "2.5rem",
                  color: "var(--app-text-color-secondary)",
                  marginBottom: "var(--spacing-3)",
                }}
              />
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 500,
                  marginBottom: "var(--spacing-2)",
                }}
              >
                Drop an image here or click to upload
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--app-text-color-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FaClipboard />
                Or paste from clipboard (Ctrl+V / Cmd+V)
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* Action buttons */}
        <div className="modal-actions" style={{ marginTop: "var(--spacing-4)" }}>
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleProcess}
            disabled={!attachedImage || isProcessing}
            style={{
              opacity: !attachedImage || isProcessing ? 0.5 : 1,
              cursor: !attachedImage || isProcessing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isProcessing ? (
              <>
                <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                Processing...
              </>
            ) : (
              "Process Schedule"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageScheduleUploadModal;

// Export settings functions for use in settings page
export { getImageAISettings, saveImageAISettings, DEFAULT_SYSTEM_PROMPT };
export type { ImageAISettings };
