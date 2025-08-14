import React, { useState, useEffect } from "react";
import { AppSettings, AIProvider } from "../types";
import { getAppSettings, saveAppSettings } from "../utils/aiConfig";

interface AISettingsFormProps {
  // Props if any, e.g., onSettingsChange callback if SettingsPage needs to react
}

const AISettingsForm: React.FC<AISettingsFormProps> = () => {
  const [appSettings, setAppSettings] = useState<AppSettings>(getAppSettings());
  const [openAIKeyInput, setOpenAIKeyInput] = useState(
    appSettings.openAIConfig?.apiKey || ""
  );
  const [geminiKeyInput, setGeminiKeyInput] = useState(
    appSettings.geminiConfig?.apiKey || ""
  );

  useEffect(() => {
    // Update local state if settings are changed elsewhere (e.g. theme toggle)
    setAppSettings(getAppSettings());
  }, []); // Re-evaluate if a dependency on global changes is needed

  const handleSave = () => {
    const newSettings: AppSettings = {
      ...appSettings,
      openAIConfig: openAIKeyInput ? { apiKey: openAIKeyInput } : undefined,
      geminiConfig: geminiKeyInput ? { apiKey: geminiKeyInput } : undefined,
    };
    saveAppSettings(newSettings);
    setAppSettings(newSettings); // Update local state
    alert("AI settings saved!"); // Simple feedback
  };

  const handleDefaultProviderChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const provider = event.target.value as AIProvider;
    const newSettings: AppSettings = {
      ...appSettings,
      defaultAIProvider: provider,
    };
    saveAppSettings(newSettings);
    setAppSettings(newSettings);
  };

  return (
    <div className="settings-form-section">
      <h3>AI Provider Configuration</h3>
      <div className="form-group">
        <label htmlFor="openai-key">OpenAI API Key:</label>
        <input
          type="password" // Keep API keys masked
          id="openai-key"
          value={openAIKeyInput}
          onChange={(e) => setOpenAIKeyInput(e.target.value)}
          placeholder="Enter your OpenAI API Key"
        />
        <div
          style={{
            marginTop: "6px",
            fontSize: "0.9em",
            color: "var(--app-text-color-secondary)",
          }}
        >
          Get your OpenAI key:{" "}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer noopener"
          >
            https://platform.openai.com/api-keys
          </a>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="gemini-key">Gemini API Key:</label>
        <input
          type="password" // Keep API keys masked
          id="gemini-key"
          value={geminiKeyInput}
          onChange={(e) => setGeminiKeyInput(e.target.value)}
          placeholder="Enter your Gemini API Key"
        />
        <div
          style={{
            marginTop: "6px",
            fontSize: "0.9em",
            color: "var(--app-text-color-secondary)",
          }}
        >
          Get your Gemini key:{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer noopener"
          >
            https://aistudio.google.com/apikey
          </a>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="default-ai-provider">Default AI Provider:</label>
        <select
          id="default-ai-provider"
          value={appSettings.defaultAIProvider || ""}
          onChange={handleDefaultProviderChange}
        >
          <option value="">None</option>
          <option value="openai" disabled={!openAIKeyInput}>
            OpenAI
          </option>
          <option value="gemini" disabled={!geminiKeyInput}>
            Gemini
          </option>
        </select>
      </div>
      <button
        onClick={handleSave}
        className="primary"
        style={{ marginTop: "10px" }}
      >
        Save AI Settings
      </button>
      <p
        style={{
          fontSize: "0.8em",
          color: "var(--app-text-color-secondary)",
          marginTop: "10px",
        }}
      >
        Note: API keys are stored locally in your browser's storage.
      </p>
    </div>
  );
};

export default AISettingsForm;
