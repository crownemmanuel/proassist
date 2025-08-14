import React, { useEffect, useMemo, useState } from "react";
import { AIProviderType } from "../types";
import {
  generateLogicSnippet,
  fetchGeminiModels,
  fetchOpenAIModels,
} from "../services/aiService";
import { getAppSettings } from "../utils/aiConfig";

interface WriteLogicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (code: string) => void;
}

const WriteLogicModal: React.FC<WriteLogicModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const appSettings = useMemo(() => getAppSettings(), []);
  const hasOpenAI = !!appSettings.openAIConfig?.apiKey;
  const hasGemini = !!appSettings.geminiConfig?.apiKey;

  const [outputType, setOutputType] = useState<"regex" | "javascript">("regex");
  const [provider, setProvider] = useState<AIProviderType | "">(
    appSettings.defaultAIProvider || ""
  );
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string>("");
  const [description, setDescription] = useState<string>(
    "Describe what you want. Example: Extract each verse and reference; one slide per verse."
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;
    setResult("");
  }, [isOpen]);

  useEffect(() => {
    // Load models when provider changes and a key exists
    (async () => {
      try {
        if (provider === "openai" && hasOpenAI) {
          const ids = await fetchOpenAIModels(appSettings.openAIConfig!.apiKey);
          setModels(ids);
        } else if (provider === "gemini" && hasGemini) {
          const ids = await fetchGeminiModels(appSettings.geminiConfig!.apiKey);
          setModels(ids);
        } else {
          setModels([]);
        }
      } catch {
        setModels([]);
      }
    })();
  }, [provider, hasOpenAI, hasGemini, appSettings]);

  if (!isOpen) return null;

  const canUseOpenAI = hasOpenAI;
  const canUseGemini = hasGemini;

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    try {
      const code = await generateLogicSnippet(
        description,
        outputType,
        (provider || undefined) as any,
        model || undefined,
        appSettings
      );
      setResult(code);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (!result.trim()) return;
    onApply(result.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Write Logic with AI</h2>
        <div className="form-group">
          <label htmlFor="wlm-desc">Describe what you want to do</label>
          <textarea
            id="wlm-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the regex or JavaScript you want."
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="form-group" style={{ minWidth: 180 }}>
            <label>Output Type</label>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as any)}
            >
              <option value="regex">Regex</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 200 }}>
            <label>AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
            >
              <option value="">Auto (default)</option>
              <option value="openai" disabled={!canUseOpenAI}>
                OpenAI {!canUseOpenAI ? "(add API key first)" : ""}
              </option>
              <option value="gemini" disabled={!canUseGemini}>
                Gemini {!canUseGemini ? "(add API key first)" : ""}
              </option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 220 }}>
            <label>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={models.length === 0}
            >
              <option value="">Auto</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Generated Code</label>
          <textarea
            rows={4}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder={
              outputType === "regex"
                ? "/^VERSE\\s*(\\d+[:\\d,-]*)[\\s\\S]*?$/gm"
                : "return input.split('\\n---\\n')"
            }
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="button-purple"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating…" : "Generate"}
          </button>
          <button
            className="primary"
            onClick={handleApply}
            disabled={!result.trim()}
          >
            Insert into Logic
          </button>
        </div>
      </div>
    </div>
  );
};

export default WriteLogicModal;
