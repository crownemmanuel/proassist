/**
 * SmartVasis Settings Component
 * 
 * Settings panel for configuring SmartVasis features:
 * - Transcription engine (AssemblyAI)
 * - AI settings (paraphrase detection, etc.)
 * - Display settings (colors)
 * - ProPresenter integration
 * - Output settings
 */

import React, { useState, useEffect, useCallback } from "react";
import { FaMicrophone, FaRobot, FaPalette, FaPlay, FaFileExport, FaSave, FaKey, FaCheckCircle, FaSpinner } from "react-icons/fa";
import {
  SmartVasisSettings as SmartVasisSettingsType,
  DEFAULT_SMART_VASIS_SETTINGS,
  TranscriptionEngine,
} from "../types/smartVasis";
import {
  loadSmartVasisSettings,
  saveSmartVasisSettings,
} from "../services/transcriptionService";
import { getEnabledConnections } from "../services/propresenterService";
import { getAppSettings } from "../utils/aiConfig";
import { fetchOpenAIModels, fetchGeminiModels, fetchGroqModels } from "../services/aiService";
import "../App.css";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const SmartVasisSettings: React.FC = () => {
  const [settings, setSettings] = useState<SmartVasisSettingsType>(DEFAULT_SMART_VASIS_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  
  // Bible Search AI model state
  const [bibleSearchModels, setBibleSearchModels] = useState<string[]>([]);
  const [bibleSearchModelsLoading, setBibleSearchModelsLoading] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSmartVasisSettings());
    loadMicrophones();
  }, []);

  // Load models when provider changes
  const loadBibleSearchModels = useCallback(async (provider: string) => {
    if (!provider) {
      setBibleSearchModels([]);
      return;
    }

    const appSettings = getAppSettings();
    setBibleSearchModelsLoading(true);
    setBibleSearchModels([]);

    try {
      let models: string[] = [];
      switch (provider) {
        case "openai":
          if (appSettings.openAIConfig?.apiKey) {
            models = await fetchOpenAIModels(appSettings.openAIConfig.apiKey);
          }
          break;
        case "gemini":
          if (appSettings.geminiConfig?.apiKey) {
            models = await fetchGeminiModels(appSettings.geminiConfig.apiKey);
          }
          break;
        case "groq":
          if (appSettings.groqConfig?.apiKey) {
            models = await fetchGroqModels(appSettings.groqConfig.apiKey);
          }
          break;
      }
      setBibleSearchModels(models);
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setBibleSearchModelsLoading(false);
    }
  }, []);

  // Load models when provider changes
  useEffect(() => {
    if (settings.bibleSearchProvider) {
      loadBibleSearchModels(settings.bibleSearchProvider);
    }
  }, [settings.bibleSearchProvider, loadBibleSearchModels]);

  // Load available microphones
  const loadMicrophones = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === "audioinput");
      setAvailableMics(mics);
    } catch (error) {
      console.error("Failed to load microphones:", error);
    }
  };

  // Handle settings change
  const handleChange = (key: keyof SmartVasisSettingsType, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaveMessage(null);
  };

  // Handle ProPresenter activation change
  const handleProPresenterChange = (key: string, value: unknown) => {
    setSettings(prev => ({
      ...prev,
      proPresenterActivation: {
        ...(prev.proPresenterActivation || { presentationUuid: "", slideIndex: 0 }),
        [key]: value,
      },
    }));
    setSaveMessage(null);
  };

  // Save settings
  const handleSave = () => {
    setIsSaving(true);
    try {
      saveSmartVasisSettings(settings);
      // Dispatch custom event so other components can react immediately
      window.dispatchEvent(new CustomEvent("smartvasis-settings-changed", { detail: settings }));
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveMessage("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Test AssemblyAI API key
  const testAssemblyAIKey = async () => {
    if (!settings.assemblyAIApiKey) {
      alert("Please enter an API key first");
      return;
    }

    try {
      const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: {
          "Authorization": settings.assemblyAIApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expires_in: 60 }),
      });

      if (response.ok) {
        alert("✅ AssemblyAI API key is valid!");
      } else {
        alert("❌ Invalid API key. Please check and try again.");
      }
    } catch {
      alert("❌ Failed to validate API key. Check your internet connection.");
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  const sectionStyle: React.CSSProperties = {
    marginBottom: "var(--spacing-6)",
    padding: "var(--spacing-4)",
    backgroundColor: "var(--app-header-bg)",
    borderRadius: "12px",
    border: "1px solid var(--app-border-color)",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--spacing-2)",
    marginBottom: "var(--spacing-4)",
    paddingBottom: "var(--spacing-3)",
    borderBottom: "1px solid var(--app-border-color)",
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: "var(--spacing-4)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "var(--spacing-2)",
    fontWeight: 500,
    fontSize: "0.9rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "var(--spacing-3)",
    borderRadius: "8px",
    border: "1px solid var(--app-border-color)",
    backgroundColor: "var(--app-input-bg-color)",
    color: "var(--app-input-text-color)",
    fontSize: "1rem",
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--spacing-2)",
    cursor: "pointer",
    marginBottom: "var(--spacing-2)",
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: "0.8rem",
    color: "var(--app-text-color-secondary)",
    marginTop: "var(--spacing-1)",
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ marginBottom: "var(--spacing-4)" }}>SmartVasis Settings</h2>
      <p style={{ marginBottom: "var(--spacing-6)", color: "var(--app-text-color-secondary)" }}>
        Configure SmartVasis smart Bible lookup and live transcription features.
      </p>

      {/* Transcription Settings */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <FaMicrophone />
          <h3 style={{ margin: 0 }}>Transcription Settings</h3>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Transcription Engine</label>
          <select
            value={settings.transcriptionEngine}
            onChange={(e) => handleChange("transcriptionEngine", e.target.value as TranscriptionEngine)}
            style={inputStyle}
          >
            <option value="assemblyai">AssemblyAI (Recommended)</option>
            <option value="elevenlabs" disabled>ElevenLabs (Coming Soon)</option>
            <option value="whisper" disabled>Whisper (Coming Soon)</option>
          </select>
          <p style={helpTextStyle}>
            AssemblyAI provides high-accuracy real-time transcription.
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>AssemblyAI API Key</label>
          <div style={{ display: "flex", gap: "var(--spacing-2)" }}>
            <input
              type="password"
              value={settings.assemblyAIApiKey || ""}
              onChange={(e) => handleChange("assemblyAIApiKey", e.target.value)}
              placeholder="Enter your AssemblyAI API key"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={testAssemblyAIKey}
              className="secondary"
              style={{ whiteSpace: "nowrap" }}
            >
              <FaKey style={{ marginRight: "4px" }} />
              Test
            </button>
          </div>
          <p style={helpTextStyle}>
            Get your API key from <a href="https://www.assemblyai.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: "var(--app-primary-color)" }}>assemblyai.com/dashboard</a>
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Microphone</label>
          <select
            value={settings.selectedMicrophoneId || ""}
            onChange={(e) => handleChange("selectedMicrophoneId", e.target.value)}
            style={inputStyle}
          >
            <option value="">Default Microphone</option>
            {availableMics.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <button
            onClick={loadMicrophones}
            className="secondary btn-sm"
            style={{ marginTop: "var(--spacing-2)" }}
          >
            Refresh Devices
          </button>
        </div>
      </div>

      {/* AI Settings */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <FaRobot />
          <h3 style={{ margin: 0 }}>AI Settings</h3>
        </div>

        <div style={{
          padding: "var(--spacing-3)",
          backgroundColor: "var(--app-bg-color)",
          borderRadius: "8px",
          marginBottom: "var(--spacing-4)",
        }}>
          <h4 style={{ margin: "0 0 var(--spacing-3) 0", fontSize: "0.95rem" }}>Bible Search AI</h4>
          <p style={{ ...helpTextStyle, marginBottom: "var(--spacing-3)" }}>
            When enabled, AI will search for Bible verses when direct reference parsing fails.
            Configure the provider and model below. API keys are configured in Settings → AI Configuration.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-3)" }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Provider</label>
              <select
                value={settings.bibleSearchProvider || ""}
                onChange={(e) => {
                  handleChange("bibleSearchProvider", e.target.value || undefined);
                  handleChange("bibleSearchModel", ""); // Reset model when provider changes
                }}
                style={inputStyle}
              >
                <option value="">Select Provider</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Model</label>
              <div style={{ position: "relative" }}>
                <select
                  value={settings.bibleSearchModel || ""}
                  onChange={(e) => handleChange("bibleSearchModel", e.target.value)}
                  disabled={!settings.bibleSearchProvider || bibleSearchModelsLoading}
                  style={inputStyle}
                >
                  <option value="">
                    {bibleSearchModelsLoading ? "Loading models..." : "Select Model"}
                  </option>
                  {bibleSearchModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {bibleSearchModelsLoading && (
                  <FaSpinner 
                    style={{
                      position: "absolute",
                      right: "40px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      animation: "spin 1s linear infinite",
                    }} 
                  />
                )}
              </div>
            </div>
          </div>

          {!settings.bibleSearchProvider && (
            <p style={{ ...helpTextStyle, color: "var(--warning)", marginTop: "var(--spacing-2)" }}>
              Select a provider and model to enable AI Bible search.
            </p>
          )}
        </div>

        <div style={fieldStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={settings.enableParaphraseDetection}
              onChange={(e) => handleChange("enableParaphraseDetection", e.target.checked)}
            />
            Enable Paraphrase Detection (Transcription)
          </label>
          <p style={helpTextStyle}>
            Detect when speakers paraphrase Bible verses without quoting them directly.
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={settings.enableKeyPointExtraction}
              onChange={(e) => handleChange("enableKeyPointExtraction", e.target.checked)}
            />
            Enable Key Point Extraction
          </label>
          <p style={helpTextStyle}>
            Extract quotable key points from sermons (requires AI).
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Paraphrase Confidence Threshold</label>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
            <input
              type="range"
              min="0.3"
              max="0.9"
              step="0.1"
              value={settings.paraphraseConfidenceThreshold}
              onChange={(e) => handleChange("paraphraseConfidenceThreshold", parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: "50px", textAlign: "right" }}>
              {Math.round(settings.paraphraseConfidenceThreshold * 100)}%
            </span>
          </div>
          <p style={helpTextStyle}>
            Only show paraphrased verses with confidence above this threshold.
          </p>
        </div>
      </div>

      {/* Display Settings */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <FaPalette />
          <h3 style={{ margin: 0 }}>Display Settings</h3>
        </div>

        <div style={fieldStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={settings.autoAddDetectedToHistory}
              onChange={(e) => handleChange("autoAddDetectedToHistory", e.target.checked)}
            />
            Add Detected Verses to Search History
          </label>
          <p style={helpTextStyle}>
            Automatically add verses detected from transcription to the chat panel.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Direct Reference Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
              <input
                type="color"
                value={settings.directReferenceColor}
                onChange={(e) => handleChange("directReferenceColor", e.target.value)}
                style={{ width: "50px", height: "36px", border: "none", cursor: "pointer" }}
              />
              <input
                type="text"
                value={settings.directReferenceColor}
                onChange={(e) => handleChange("directReferenceColor", e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Paraphrase Reference Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
              <input
                type="color"
                value={settings.paraphraseReferenceColor}
                onChange={(e) => handleChange("paraphraseReferenceColor", e.target.value)}
                style={{ width: "50px", height: "36px", border: "none", cursor: "pointer" }}
              />
              <input
                type="text"
                value={settings.paraphraseReferenceColor}
                onChange={(e) => handleChange("paraphraseReferenceColor", e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ProPresenter Integration */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <FaPlay />
          <h3 style={{ margin: 0 }}>ProPresenter Integration</h3>
        </div>

        <div style={fieldStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={settings.autoTriggerOnDetection}
              onChange={(e) => handleChange("autoTriggerOnDetection", e.target.checked)}
            />
            Auto-Trigger on Detection
          </label>
          <p style={helpTextStyle}>
            Automatically go live when a Bible verse is detected in transcription.
          </p>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Presentation UUID</label>
          <input
            type="text"
            value={settings.proPresenterActivation?.presentationUuid || ""}
            onChange={(e) => handleProPresenterChange("presentationUuid", e.target.value)}
            placeholder="ProPresenter presentation UUID"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Slide Index</label>
          <input
            type="number"
            min="0"
            value={settings.proPresenterActivation?.slideIndex || 0}
            onChange={(e) => handleProPresenterChange("slideIndex", parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>ProPresenter Connections</label>
          <div style={{ 
            padding: "var(--spacing-2)", 
            backgroundColor: "var(--app-bg-color)",
            borderRadius: "6px",
            fontSize: "0.85rem",
          }}>
            {getEnabledConnections().length > 0 ? (
              <p style={{ margin: 0, color: "var(--success)" }}>
                <FaCheckCircle style={{ marginRight: "6px" }} />
                {getEnabledConnections().length} connection(s) enabled
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--app-text-color-secondary)" }}>
                No ProPresenter connections enabled. Configure in Settings → ProPresenter.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Output Settings */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <FaFileExport />
          <h3 style={{ margin: 0 }}>Output Settings</h3>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Output Path</label>
          <input
            type="text"
            value={settings.bibleOutputPath || ""}
            onChange={(e) => handleChange("bibleOutputPath", e.target.value)}
            placeholder="/path/to/output/folder"
            style={inputStyle}
          />
          <p style={helpTextStyle}>
            Directory where verse text files will be saved.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--spacing-4)" }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Verse Text Filename</label>
            <input
              type="text"
              value={settings.bibleTextFileName || ""}
              onChange={(e) => handleChange("bibleTextFileName", e.target.value)}
              placeholder="verse_text.txt"
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Reference Filename</label>
            <input
              type="text"
              value={settings.bibleReferenceFileName || ""}
              onChange={(e) => handleChange("bibleReferenceFileName", e.target.value)}
              placeholder="verse_reference.txt"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={settings.clearTextAfterLive || false}
              onChange={(e) => handleChange("clearTextAfterLive", e.target.checked)}
            />
            Clear Text After Going Live
          </label>
        </div>

        {settings.clearTextAfterLive && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Clear Delay (ms)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={settings.clearTextDelay || 0}
              onChange={(e) => handleChange("clearTextDelay", parseInt(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--spacing-4)",
        backgroundColor: "var(--app-header-bg)",
        borderRadius: "12px",
        border: "1px solid var(--app-border-color)",
      }}>
        {saveMessage && (
          <span style={{
            color: saveMessage.includes("success") ? "var(--success)" : "var(--error)",
          }}>
            {saveMessage}
          </span>
        )}
        {!saveMessage && <span />}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="primary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-2)",
          }}
        >
          <FaSave />
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default SmartVasisSettings;
