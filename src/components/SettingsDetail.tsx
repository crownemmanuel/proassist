import React, { useState, useEffect, useMemo } from "react";
import {
  Template,
  TemplateType,
  LayoutType,
  AIProviderType,
  OpenAIModelType,
  GeminiModelType,
} from "../types";
import "../App.css";
import WriteLogicModal from "./WriteLogicModal";
import { fetchGeminiModels, fetchOpenAIModels } from "../services/aiService";
import { getAppSettings } from "../utils/aiConfig";

interface SettingsDetailProps {
  template: Template;
  onSave: (template: Template) => void;
}

const SettingsDetail: React.FC<SettingsDetailProps> = ({
  template,
  onSave,
}) => {
  const [name, setName] = useState(template.name);
  const [color, setColor] = useState(template.color);
  const [type, setType] = useState<TemplateType>(template.type);
  const [logic, setLogic] = useState(template.logic || "");
  const [availableLayouts, setAvailableLayouts] = useState<LayoutType[]>(
    template.availableLayouts || []
  );
  const [aiPrompt, setAiPrompt] = useState(template.aiPrompt || "");
  const [processWithAI, setProcessWithAI] = useState(
    template.processWithAI || false
  );
  const [outputPath, setOutputPath] = useState(template.outputPath || "");
  const [outputFileNamePrefix, setOutputFileNamePrefix] = useState(
    template.outputFileNamePrefix || ""
  );
  const [aiProvider, setAiProvider] = useState<AIProviderType | undefined>(
    template.aiProvider
  );
  const [aiModel, setAiModel] = useState<
    OpenAIModelType | GeminiModelType | string | undefined
  >(template.aiModel);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  const appSettings = useMemo(() => getAppSettings(), []);
  const hasOpenAI = !!appSettings.openAIConfig?.apiKey;
  const hasGemini = !!appSettings.geminiConfig?.apiKey;

  const allLayoutTypes: LayoutType[] = [
    "one-line",
    "two-line",
    "three-line",
    "four-line",
    "five-line",
    "six-line",
  ];

  useEffect(() => {
    if (template) {
      setName(template.name);
      setColor(template.color);
      setType(template.type);
      setLogic(template.logic || "");
      setAvailableLayouts(template.availableLayouts || []);
      setAiPrompt(template.aiPrompt || "");
      setProcessWithAI(template.processWithAI || false);
      setOutputPath(template.outputPath || "");
      setOutputFileNamePrefix(template.outputFileNamePrefix || "");
      setAiProvider(template.aiProvider);
      setAiModel(template.aiModel);
    }
  }, [template]);

  // Load available models when provider changes
  useEffect(() => {
    (async () => {
      try {
        if (aiProvider === "openai" && hasOpenAI) {
          const ids = await fetchOpenAIModels(appSettings.openAIConfig!.apiKey);
          setModels(ids);
        } else if (aiProvider === "gemini" && hasGemini) {
          const ids = await fetchGeminiModels(appSettings.geminiConfig!.apiKey);
          setModels(ids);
        } else {
          setModels([]);
        }
      } catch {
        setModels([]);
      }
    })();
  }, [aiProvider, hasOpenAI, hasGemini, appSettings]);

  const handleSave = () => {
    if (!name.trim() || !outputPath.trim() || !outputFileNamePrefix.trim()) {
      alert(
        "Template name, output path and output file name prefix are required."
      );
      return;
    }
    onSave({
      ...template,
      name,
      color,
      type,
      logic,
      availableLayouts,
      aiPrompt,
      processWithAI,
      outputPath,
      outputFileNamePrefix,
      aiProvider: processWithAI ? aiProvider : undefined,
      aiModel: processWithAI ? aiModel : undefined,
    });
  };

  const toggleLayout = (layout: LayoutType) => {
    setAvailableLayouts((prev) =>
      prev.includes(layout)
        ? prev.filter((l) => l !== layout)
        : [...prev, layout]
    );
  };

  return (
    <div className="settings-detail-form">
      <h3>Edit Template: {template.name}</h3>
      <div className="form-group">
        <label htmlFor="template-name">Name:</label>
        <input
          type="text"
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="template-color">Color:</label>
        <input
          type="color"
          id="template-color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="template-type">Type:</label>
        <select
          id="template-type"
          value={type}
          onChange={(e) => setType(e.target.value as TemplateType)}
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>
      <div className="form-group">
        <label>Available Layouts:</label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "5px",
            marginTop: "5px",
          }}
        >
          {allLayoutTypes.map((layout) => (
            <button
              key={layout}
              onClick={() => toggleLayout(layout)}
              className={
                availableLayouts.includes(layout) ? "chip-selected" : "chip"
              }
              style={{ fontSize: "0.8em", padding: "3px 6px" }}
            >
              {layout
                .replace("-line", "")
                .replace("-", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <label htmlFor="template-logic" style={{ marginBottom: 4 }}>
            Logic/Notes:
          </label>
          <button
            className="button-purple"
            onClick={() => setIsWriteModalOpen(true)}
          >
            Write with AI
          </button>
        </div>
        <textarea
          id="template-logic"
          value={logic}
          onChange={(e) => setLogic(e.target.value)}
          placeholder="Enter JavaScript or /regex/flags to split/process text (optional)"
          rows={4}
        />
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--app-text-color-secondary)",
            marginTop: 6,
          }}
        >
          Tip: Provide a JavaScript snippet that returns an array of strings or{" "}
          {"{ text, layout }"} items, or a regex in the form{" "}
          <code>/pattern/flags</code>. Left empty to use basic paragraph split.
        </div>
      </div>

      {/* AI Processing Fields */}
      <div className="form-group">
        <label
          htmlFor="template-process-ai"
          style={{ display: "flex", alignItems: "center" }}
        >
          <input
            type="checkbox"
            id="template-process-ai"
            checked={processWithAI}
            onChange={(e) => setProcessWithAI(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          Process with AI
        </label>
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--app-text-color-secondary)",
            marginTop: 6,
          }}
        >
          Enabling this sends your text to an LLM (OpenAI or Gemini) to generate
          slides based on your prompt.
        </div>
      </div>

      <WriteLogicModal
        isOpen={isWriteModalOpen}
        onClose={() => setIsWriteModalOpen(false)}
        onApply={(code) => setLogic(code)}
      />

      {processWithAI && (
        <>
          <div className="form-group">
            <label htmlFor="template-ai-provider">AI Provider:</label>
            <select
              id="template-ai-provider"
              value={aiProvider || ""}
              onChange={(e) => {
                const newProvider = e.target.value as AIProviderType;
                setAiProvider(newProvider);
                setAiModel(undefined);
              }}
            >
              <option value="" disabled>
                Select a provider
              </option>
              <option value="openai" disabled={!hasOpenAI}>
                OpenAI {!hasOpenAI ? "(add API key first)" : ""}
              </option>
              <option value="gemini" disabled={!hasGemini}>
                Google Gemini {!hasGemini ? "(add API key first)" : ""}
              </option>
            </select>
          </div>

          {aiProvider && (
            <div className="form-group">
              <label htmlFor="template-ai-model">AI Model:</label>
              <select
                id="template-ai-model"
                value={aiModel || ""}
                onChange={(e) =>
                  setAiModel(
                    e.target.value as OpenAIModelType | GeminiModelType
                  )
                }
                disabled={!aiProvider || models.length === 0}
              >
                <option value="" disabled>
                  {models.length === 0
                    ? "No models available"
                    : "Select a model"}
                </option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="template-ai-prompt">AI Prompt:</label>
            <textarea
              id="template-ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter the prompt for the AI to process the input text."
              rows={4}
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="template-output-path">Output Path:</label>
        <input
          type="text"
          id="template-output-path"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="e.g., /Users/youruser/ProPresenterOutput/Sermon"
        />
      </div>
      <div className="form-group">
        <label htmlFor="template-output-prefix">Output File Name Prefix:</label>
        <input
          type="text"
          id="template-output-prefix"
          value={outputFileNamePrefix}
          onChange={(e) => setOutputFileNamePrefix(e.target.value)}
          placeholder="e.g., SermonNote"
        />
      </div>

      <button
        onClick={handleSave}
        className="primary"
        style={{ marginTop: "15px" }}
      >
        Save Template
      </button>
    </div>
  );
};

export default SettingsDetail;
