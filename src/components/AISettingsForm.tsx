import React, { useState, useEffect } from "react";
import { AppSettings, AIProvider, AIProviderType, AIModelSetting } from "../types";
import { getAppSettings, saveAppSettings } from "../utils/aiConfig";
import { fetchOpenAIModels, fetchGeminiModels } from "../services/aiService";
import { FaSpinner } from "react-icons/fa";

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

  // Spell check model settings
  const [spellCheckProvider, setSpellCheckProvider] = useState<AIProviderType | "">(
    appSettings.spellCheckModel?.provider || ""
  );
  const [spellCheckModel, setSpellCheckModel] = useState(
    appSettings.spellCheckModel?.model || ""
  );
  const [spellCheckModels, setSpellCheckModels] = useState<string[]>([]);
  const [spellCheckModelsLoading, setSpellCheckModelsLoading] = useState(false);

  // Timer AI assistant model settings
  const [timerAssistantProvider, setTimerAssistantProvider] = useState<AIProviderType | "">(
    appSettings.timerAssistantModel?.provider || ""
  );
  const [timerAssistantModel, setTimerAssistantModel] = useState(
    appSettings.timerAssistantModel?.model || ""
  );
  const [timerAssistantModels, setTimerAssistantModels] = useState<string[]>([]);
  const [timerAssistantModelsLoading, setTimerAssistantModelsLoading] = useState(false);

  useEffect(() => {
    // Update local state if settings are changed elsewhere (e.g. theme toggle)
    const settings = getAppSettings();
    setAppSettings(settings);
    setSpellCheckProvider(settings.spellCheckModel?.provider || "");
    setSpellCheckModel(settings.spellCheckModel?.model || "");
    setTimerAssistantProvider(settings.timerAssistantModel?.provider || "");
    setTimerAssistantModel(settings.timerAssistantModel?.model || "");
  }, []); // Re-evaluate if a dependency on global changes is needed

  // Fetch models when spell check provider changes
  useEffect(() => {
    (async () => {
      if (!spellCheckProvider) {
        setSpellCheckModels([]);
        return;
      }
      
      setSpellCheckModelsLoading(true);
      try {
        if (spellCheckProvider === "openai" && openAIKeyInput) {
          const models = await fetchOpenAIModels(openAIKeyInput);
          setSpellCheckModels(models);
          // If current model not in list, select first
          if (models.length > 0 && !models.includes(spellCheckModel)) {
            setSpellCheckModel(models[0]);
          }
        } else if (spellCheckProvider === "gemini" && geminiKeyInput) {
          const models = await fetchGeminiModels(geminiKeyInput);
          setSpellCheckModels(models);
          if (models.length > 0 && !models.includes(spellCheckModel)) {
            setSpellCheckModel(models[0]);
          }
        } else {
          setSpellCheckModels([]);
        }
      } catch {
        setSpellCheckModels([]);
      } finally {
        setSpellCheckModelsLoading(false);
      }
    })();
  }, [spellCheckProvider, openAIKeyInput, geminiKeyInput]);

  // Fetch models when timer assistant provider changes
  useEffect(() => {
    (async () => {
      if (!timerAssistantProvider) {
        setTimerAssistantModels([]);
        return;
      }
      
      setTimerAssistantModelsLoading(true);
      try {
        if (timerAssistantProvider === "openai" && openAIKeyInput) {
          const models = await fetchOpenAIModels(openAIKeyInput);
          setTimerAssistantModels(models);
          if (models.length > 0 && !models.includes(timerAssistantModel)) {
            setTimerAssistantModel(models[0]);
          }
        } else if (timerAssistantProvider === "gemini" && geminiKeyInput) {
          const models = await fetchGeminiModels(geminiKeyInput);
          setTimerAssistantModels(models);
          if (models.length > 0 && !models.includes(timerAssistantModel)) {
            setTimerAssistantModel(models[0]);
          }
        } else {
          setTimerAssistantModels([]);
        }
      } catch {
        setTimerAssistantModels([]);
      } finally {
        setTimerAssistantModelsLoading(false);
      }
    })();
  }, [timerAssistantProvider, openAIKeyInput, geminiKeyInput]);

  const handleSave = () => {
    const spellCheckSetting: AIModelSetting | undefined = 
      spellCheckProvider && spellCheckModel
        ? { provider: spellCheckProvider as AIProviderType, model: spellCheckModel }
        : undefined;

    const timerAssistantSetting: AIModelSetting | undefined =
      timerAssistantProvider && timerAssistantModel
        ? { provider: timerAssistantProvider as AIProviderType, model: timerAssistantModel }
        : undefined;

    const newSettings: AppSettings = {
      ...appSettings,
      openAIConfig: openAIKeyInput ? { apiKey: openAIKeyInput } : undefined,
      geminiConfig: geminiKeyInput ? { apiKey: geminiKeyInput } : undefined,
      spellCheckModel: spellCheckSetting,
      timerAssistantModel: timerAssistantSetting,
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

  const handleSpellCheckProviderChange = (provider: AIProviderType | "") => {
    setSpellCheckProvider(provider);
    // Model will be fetched and set by the useEffect
    if (!provider) {
      setSpellCheckModel("");
      setSpellCheckModels([]);
    }
  };

  const handleTimerAssistantProviderChange = (provider: AIProviderType | "") => {
    setTimerAssistantProvider(provider);
    // Model will be fetched and set by the useEffect
    if (!provider) {
      setTimerAssistantModel("");
      setTimerAssistantModels([]);
    }
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

      {/* AI Model Settings Section */}
      <div
        style={{
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: "1px solid var(--app-border-color)",
        }}
      >
        <h4 style={{ marginBottom: "16px", color: "var(--app-text-color)" }}>
          AI Model Settings
        </h4>
        <p
          style={{
            fontSize: "0.85em",
            color: "var(--app-text-color-secondary)",
            marginBottom: "16px",
          }}
        >
          Configure which AI model to use for specific features. If not set, the default provider will be used.
        </p>

        {/* Spell Check Model */}
        <div
          style={{
            backgroundColor: "var(--app-header-bg)",
            padding: "14px",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#22c55e" }}>✓</span> Spell Check / Proofread
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "140px" }}>
              <label
                htmlFor="spell-check-provider"
                style={{ fontSize: "0.85em", display: "block", marginBottom: "4px" }}
              >
                Provider:
              </label>
              <select
                id="spell-check-provider"
                value={spellCheckProvider}
                onChange={(e) => handleSpellCheckProviderChange(e.target.value as AIProviderType | "")}
                style={{ width: "100%" }}
              >
                <option value="">Use Default</option>
                <option value="openai" disabled={!openAIKeyInput}>
                  OpenAI
                </option>
                <option value="gemini" disabled={!geminiKeyInput}>
                  Gemini
                </option>
              </select>
            </div>
            <div style={{ flex: "2", minWidth: "200px" }}>
              <label
                htmlFor="spell-check-model"
                style={{ fontSize: "0.85em", display: "block", marginBottom: "4px" }}
              >
                Model:
              </label>
              <div style={{ position: "relative" }}>
                <select
                  id="spell-check-model"
                  value={spellCheckModel}
                  onChange={(e) => setSpellCheckModel(e.target.value)}
                  disabled={!spellCheckProvider || spellCheckModelsLoading}
                  style={{ width: "100%" }}
                >
                  {!spellCheckProvider && <option value="">Select provider first</option>}
                  {spellCheckModelsLoading && <option value="">Loading models...</option>}
                  {!spellCheckModelsLoading && spellCheckProvider && spellCheckModels.length === 0 && (
                    <option value="">No models found</option>
                  )}
                  {spellCheckModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {spellCheckModelsLoading && (
                  <FaSpinner
                    style={{
                      position: "absolute",
                      right: "30px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      animation: "spin 1s linear infinite",
                      color: "#a855f7",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timer AI Assistant Model */}
        <div
          style={{
            backgroundColor: "var(--app-header-bg)",
            padding: "14px",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#3b82f6" }}>⏱</span> Timer AI Assistant
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "140px" }}>
              <label
                htmlFor="timer-assistant-provider"
                style={{ fontSize: "0.85em", display: "block", marginBottom: "4px" }}
              >
                Provider:
              </label>
              <select
                id="timer-assistant-provider"
                value={timerAssistantProvider}
                onChange={(e) => handleTimerAssistantProviderChange(e.target.value as AIProviderType | "")}
                style={{ width: "100%" }}
              >
                <option value="">Use Default</option>
                <option value="openai" disabled={!openAIKeyInput}>
                  OpenAI
                </option>
                <option value="gemini" disabled={!geminiKeyInput}>
                  Gemini
                </option>
              </select>
            </div>
            <div style={{ flex: "2", minWidth: "200px" }}>
              <label
                htmlFor="timer-assistant-model"
                style={{ fontSize: "0.85em", display: "block", marginBottom: "4px" }}
              >
                Model:
              </label>
              <div style={{ position: "relative" }}>
                <select
                  id="timer-assistant-model"
                  value={timerAssistantModel}
                  onChange={(e) => setTimerAssistantModel(e.target.value)}
                  disabled={!timerAssistantProvider || timerAssistantModelsLoading}
                  style={{ width: "100%" }}
                >
                  {!timerAssistantProvider && <option value="">Select provider first</option>}
                  {timerAssistantModelsLoading && <option value="">Loading models...</option>}
                  {!timerAssistantModelsLoading && timerAssistantProvider && timerAssistantModels.length === 0 && (
                    <option value="">No models found</option>
                  )}
                  {timerAssistantModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                {timerAssistantModelsLoading && (
                  <FaSpinner
                    style={{
                      position: "absolute",
                      right: "30px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      animation: "spin 1s linear infinite",
                      color: "#a855f7",
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="primary"
        style={{ marginTop: "16px" }}
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

      <style>{`
        @keyframes spin {
          from { transform: translateY(-50%) rotate(0deg); }
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AISettingsForm;
