import React, { useEffect, useState } from "react";
import { TemplateType } from "../types";

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (newTemplateData: {
    name: string;
    type: TemplateType;
    color: string;
    logic: string;
    processingType: "simple" | "regex" | "javascript" | "ai";
  }) => void;
}

const AddTemplateModal: React.FC<AddTemplateModalProps> = ({
  isOpen,
  onClose,
  onAddTemplate,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("text");
  const [color, setColor] = useState("#4caf50");
  const [processingType, setProcessingType] = useState<
    "simple" | "regex" | "javascript" | "ai"
  >("simple");
  const [logic, setLogic] = useState("line-break");
  const [simpleStrategy, setSimpleStrategy] = useState("line-break");
  const [simpleValue, setSimpleValue] = useState(50);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setType("text");
      setColor("#4caf50");
      setProcessingType("simple");
      setLogic("line-break");
      setSimpleStrategy("line-break");
      setSimpleValue(50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (processingType !== "simple") return;

    if (simpleStrategy === "line-break") {
      setLogic("line-break");
    } else {
      setLogic(`${simpleStrategy}-${simpleValue}`);
    }
  }, [simpleStrategy, simpleValue, processingType]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Template name is required.");
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

    onAddTemplate({ name, type, color, logic: finalLogic, processingType });
    onClose();
  };

  if (!isOpen) return null;

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
              Return an array of strings. Example:{" "}
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
              value={logic}
              onChange={(e) => setLogic(e.target.value)}
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
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>New Template Details</h2>
        <div className="form-group">
          <label htmlFor="tpl-name">Name</label>
          <input
            id="tpl-name"
            type="text"
            placeholder="Template Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
          <label htmlFor="tpl-color">Color</label>
          <input
            id="tpl-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTemplateModal;
