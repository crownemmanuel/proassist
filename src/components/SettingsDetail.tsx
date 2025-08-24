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
import IconPickerModal from "./IconPickerModal";
import { fetchGeminiModels, fetchOpenAIModels } from "../services/aiService";
import { getAppSettings } from "../utils/aiConfig";
import { FaArrowLeft } from "react-icons/fa";

interface SettingsDetailProps {
  template: Template;
  onSave: (template: Template) => void;
  onBack: () => void;
}

const SettingsDetail: React.FC<SettingsDetailProps> = ({
  template,
  onSave,
  onBack,
}) => {
  const [name, setName] = useState(template.name);
  const [icon, setIcon] = useState(template.icon);
  const [color, setColor] = useState(template.color);
  const [type, setType] = useState<TemplateType>(template.type);
  const [logic, setLogic] = useState(template.logic || "line-break");
  const [processingType, setProcessingType] = useState(
    template.processingType || "simple"
  );
  const [simpleStrategy, setSimpleStrategy] = useState("line-break");
  const [simpleValue, setSimpleValue] = useState(50);

  const [availableLayouts, setAvailableLayouts] = useState<LayoutType[]>(
    template.availableLayouts || []
  );
  const [aiPrompt, setAiPrompt] = useState(template.aiPrompt || "");
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
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
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
      setIcon(template.icon);
      setColor(template.color);
      setType(template.type);
      setLogic(template.logic || "line-break");
      setProcessingType(template.processingType || "simple");

      const logicStr = template.logic || "line-break";
      if (logicStr === "line-break") {
        setSimpleStrategy("line-break");
        setSimpleValue(50);
      } else {
        const match = logicStr.match(/^(word-count|char-count)-(\d+)$/);
        if (match) {
          setSimpleStrategy(match[1]);
          setSimpleValue(parseInt(match[2], 10) || 50);
        } else {
          // Fallback to a valid default to avoid an invalid <select> value
          setSimpleStrategy("line-break");
          setSimpleValue(50);
        }
      }

      setAvailableLayouts(template.availableLayouts || []);
      setAiPrompt(template.aiPrompt || "");
      setOutputPath(template.outputPath || "");
      setOutputFileNamePrefix(template.outputFileNamePrefix || "");
      setAiProvider(template.aiProvider);
      setAiModel(template.aiModel);
    }
  }, [template]);

  useEffect(() => {
    if (processingType !== "simple") return;

    if (simpleStrategy === "line-break") {
      setLogic("line-break");
    } else {
      setLogic(`${simpleStrategy}-${simpleValue}`);
    }
  }, [simpleStrategy, simpleValue, processingType]);

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

    let finalLogic = logic;
    if (processingType === "simple") {
      if (simpleStrategy === "line-break") {
        finalLogic = "line-break";
      } else {
        finalLogic = `${simpleStrategy}-${simpleValue}`;
      }
    }

    onSave({
      ...template,
      name,
      icon,
      color,
      type,
      logic: finalLogic,
      processingType,
      availableLayouts,
      // aiPrompt captured from dedicated AI prompt field
      outputPath,
      outputFileNamePrefix,
      aiPrompt: aiPrompt,
      aiProvider: processingType === "ai" ? aiProvider : undefined,
      aiModel: processingType === "ai" ? aiModel : undefined,
    });
  };

  const toggleLayout = (layout: LayoutType) => {
    setAvailableLayouts((prev) =>
      prev.includes(layout)
        ? prev.filter((l) => l !== layout)
        : [...prev, layout]
    );
  };

  const renderLogicInput = () => {
    switch (processingType) {
      case "regex":
        return (
          <div className="form-group">
            <label htmlFor="tpl-logic-regex">Regex Logic</label>
            <input
              id="tpl-logic-regex"
              type="text"
              placeholder="/your-regex/flags"
              value={logic}
              onChange={(e) => setLogic(e.target.value)}
            />
            <p className="instruction-text">
              Enter a regular expression to split the text. Example:{" "}
              <code>/\n\s*\n/</code> to split by empty lines.
            </p>
          </div>
        );
      case "javascript":
        return (
          <div className="form-group">
            <label htmlFor="tpl-logic-js">JavaScript Logic</label>
            <textarea
              id="tpl-logic-js"
              placeholder="return input.split(' ')..."
              value={logic}
              onChange={(e) => setLogic(e.target.value)}
              rows={4}
            />
            <p className="instruction-text">
              Write a JavaScript snippet. The 'input' variable holds the text.
              Return an array of strings. Example:
              <code>{"return input.split('.').map(s => s.trim());"}</code>
            </p>
          </div>
        );
      case "ai":
        return (
          <div className="form-group">
            <label htmlFor="tpl-logic-ai">AI Prompt</label>
            <textarea
              id="tpl-logic-ai"
              placeholder="Summarize the following text for a presentation..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={4}
            />
            <p className="instruction-text">
              Describe how the AI should process the text. The more detailed
              your instruction, the better the result.
            </p>
          </div>
        );
      case "simple":
      default:
        const handleSimpleTypeChange = (newStrategy: string) => {
          setSimpleStrategy(newStrategy);
          if (newStrategy === "word-count") {
            setSimpleValue(50);
          } else if (newStrategy === "char-count") {
            setSimpleValue(250);
          }
        };

        return (
          <div className="form-group">
            <label>Simple Split</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={simpleStrategy}
                onChange={(e) => handleSimpleTypeChange(e.target.value)}
                className="select-css"
              >
                <option value="line-break">By Line Break</option>
                <option value="word-count">By Word Count</option>
                <option value="char-count">By Character Count</option>
              </select>
              {simpleStrategy !== "line-break" && (
                <input
                  type="number"
                  value={simpleValue}
                  onChange={(e) =>
                    setSimpleValue(parseInt(e.target.value, 10) || 1)
                  }
                  style={{ width: "80px" }}
                  min="1"
                />
              )}
            </div>
            <p className="instruction-text">
              Choose a simple way to split your text into slides.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="settings-detail-container">
      <div className="settings-detail-header">
        <button onClick={onBack} className="icon-button">
          <FaArrowLeft />
        </button>
        <h3>Edit Template: {template.name}</h3>
      </div>
      <div className="settings-detail-form">
        <div className="settings-detail-section">
          <h4>Title & Icon</h4>
          <div className="form-group">
            <label htmlFor="template-name">Name:</label>
            <input
              type="text"
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group-inline">
            <div className="form-group">
              <label htmlFor="template-icon">Icon:</label>
              <div
                className="icon-picker-placeholder"
                onClick={() => setIsIconPickerOpen(true)}
              >
                {icon && (
                  <span
                    className="template-icon"
                    style={{ backgroundColor: color }}
                  >
                    {icon.slice(0, 2)}
                  </span>
                )}
              </div>
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
          </div>
        </div>

        <div className="settings-detail-section">
          <h4>Configuration</h4>
          <div className="form-group">
            <label>Processing Type</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="simple"
                  checked={processingType === "simple"}
                  onChange={() => setProcessingType("simple")}
                />
                Simple
              </label>
              <label>
                <input
                  type="radio"
                  value="regex"
                  checked={processingType === "regex"}
                  onChange={() => setProcessingType("regex")}
                />
                Regex
              </label>
              <label>
                <input
                  type="radio"
                  value="javascript"
                  checked={processingType === "javascript"}
                  onChange={() => setProcessingType("javascript")}
                />
                JavaScript
              </label>
              <label>
                <input
                  type="radio"
                  value="ai"
                  checked={processingType === "ai"}
                  onChange={() => setProcessingType("ai")}
                />
                AI
              </label>
            </div>
          </div>
          {renderLogicInput()}
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
        </div>

        {processingType === "ai" && (
          <div className="settings-detail-section">
            <h4>AI Configuration</h4>
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
          </div>
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
          <label htmlFor="template-output-prefix">
            Output File Name Prefix:
          </label>
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
      <IconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        onSelectIcon={(iconName) => setIcon(iconName)}
      />
    </div>
  );
};

export default SettingsDetail;
