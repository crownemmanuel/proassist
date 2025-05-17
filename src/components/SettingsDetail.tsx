import React, { useState, useEffect } from "react";
import {
  Template,
  TemplateType,
  LayoutType,
  AIPoweredTemplate,
} from "../types";
import "../App.css";

interface SettingsDetailProps {
  template: Template | AIPoweredTemplate;
  onSave: (updatedTemplate: Template | AIPoweredTemplate) => void;
}

const allLayoutTypes: LayoutType[] = [
  "one-line",
  "two-line",
  "three-line",
  "four-line",
  "five-line",
  "six-line",
];
const allTemplateTypes: TemplateType[] = [
  "Simple",
  "Regex",
  "JavaScript Formula",
  "AI Powered",
];

const SettingsDetail: React.FC<SettingsDetailProps> = ({
  template,
  onSave,
}) => {
  const [name, setName] = useState(template.name);
  const [color, setColor] = useState(template.color);
  const [type, setType] = useState<TemplateType>(template.type);
  const [logic, setLogic] = useState(template.logic);
  const [availableLayouts, setAvailableLayouts] = useState<LayoutType[]>(
    template.availableLayouts
  );
  const [promptText, setPromptText] = useState(
    template.type === "AI Powered" ? (template as AIPoweredTemplate).prompt : ""
  );
  const [outputPath, setOutputPath] = useState(template.outputPath || "");
  const [outputFileNamePrefix, setOutputFileNamePrefix] = useState(
    template.outputFileNamePrefix || ""
  );

  useEffect(() => {
    setName(template.name);
    setColor(template.color);
    setType(template.type);
    setLogic(template.logic);
    setAvailableLayouts(template.availableLayouts);
    if (template.type === "AI Powered") {
      setPromptText((template as AIPoweredTemplate).prompt || "");
    } else {
      setPromptText("");
    }
    setOutputPath(template.outputPath || "");
    setOutputFileNamePrefix(template.outputFileNamePrefix || "");
  }, [template]);

  const handleSave = () => {
    let updatedTemplate: Template | AIPoweredTemplate = {
      ...template,
      name,
      color,
      type,
      logic,
      availableLayouts,
      outputPath,
      outputFileNamePrefix,
    };
    if (type === "AI Powered") {
      (updatedTemplate as AIPoweredTemplate).prompt = promptText;
    }
    onSave(updatedTemplate);
  };

  const handleLayoutToggle = (layout: LayoutType) => {
    setAvailableLayouts((prev) =>
      prev.includes(layout)
        ? prev.filter((l) => l !== layout)
        : [...prev, layout]
    );
  };

  const getLogicInputLabel = () => {
    switch (type) {
      case "Simple":
        return "Description (e.g., Line Break, Paragraph Break)";
      case "Regex":
        return "Regular Expression";
      case "JavaScript Formula":
        return "JavaScript Code Snippet";
      case "AI Powered":
        return "Base Prompt for AI (Content Grouping Instructions)";
      default:
        return "Logic/Configuration";
    }
  };

  const formRowStyle: React.CSSProperties = { marginBottom: "15px" };
  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    fontWeight: 500,
    color: "var(--app-text-color-secondary)",
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "outputPath") {
      setOutputPath(value);
    } else if (name === "outputFileNamePrefix") {
      setOutputFileNamePrefix(value);
    }
  };

  return (
    <div>
      <h3
        style={{
          marginTop: 0,
          borderBottom: "1px solid var(--app-border-color)",
          paddingBottom: "10px",
          marginBottom: "20px",
        }}
      >
        Edit Template:{" "}
        <span style={{ color: "var(--app-primary-color)" }}>
          {template.name}
        </span>
      </h3>
      <div style={formRowStyle}>
        <label htmlFor="templateName" style={labelStyle}>
          Name:
        </label>
        <input
          type="text"
          id="templateName"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div style={formRowStyle}>
        <label htmlFor="templateColor" style={labelStyle}>
          Color:
        </label>
        <input
          type="color"
          id="templateColor"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

      <div style={formRowStyle}>
        <label htmlFor="templateType" style={labelStyle}>
          Template Type:
        </label>
        <select
          id="templateType"
          value={type}
          onChange={(e) => setType(e.target.value as TemplateType)}
        >
          {allTemplateTypes.map((tt) => (
            <option key={tt} value={tt}>
              {tt}
            </option>
          ))}
        </select>
      </div>

      <div style={formRowStyle}>
        <label htmlFor="templateLogic" style={labelStyle}>
          {getLogicInputLabel()}:
        </label>
        {type === "JavaScript Formula" ||
        type === "Regex" ||
        type === "AI Powered" ? (
          <textarea
            id="templateLogic"
            value={logic}
            onChange={(e) => setLogic(e.target.value)}
            rows={5}
            style={{ fontFamily: "monospace" }}
            placeholder={getLogicInputLabel()}
          />
        ) : (
          <input
            type="text"
            id="templateLogic"
            value={logic}
            onChange={(e) => setLogic(e.target.value)}
            placeholder={getLogicInputLabel()}
          />
        )}
      </div>

      {type === "AI Powered" && (
        <div style={formRowStyle}>
          <label htmlFor="aiPrompt" style={labelStyle}>
            AI Prompt (Specific Instructions for Layout/Splitting):
          </label>
          <textarea
            id="aiPrompt"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={4}
            placeholder="e.g., Group related thoughts into slides. Use two-line layouts for headings. Split sections by '---'."
          />
        </div>
      )}

      <div style={formRowStyle}>
        <label style={labelStyle}>Available Slide Layouts:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {allLayoutTypes.map((layout) => (
            <label
              key={layout}
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={availableLayouts.includes(layout)}
                onChange={() => handleLayoutToggle(layout)}
                style={{ marginRight: "5px", width: "auto" }}
              />
              {layout}
            </label>
          ))}
        </div>
      </div>

      <div style={formRowStyle}>
        <label htmlFor="outputPath" style={labelStyle}>
          Output Path:
        </label>
        <input
          type="text"
          id="outputPath"
          name="outputPath"
          value={outputPath}
          onChange={handleChange}
          placeholder="e.g., /Users/name/SlidesOutput/"
        />
      </div>

      <div style={formRowStyle}>
        <label htmlFor="outputFileNamePrefix" style={labelStyle}>
          Output File Name Prefix:
        </label>
        <input
          type="text"
          id="outputFileNamePrefix"
          name="outputFileNamePrefix"
          value={outputFileNamePrefix}
          onChange={handleChange}
          placeholder="e.g., sermon_slide_"
        />
      </div>

      <button
        onClick={handleSave}
        className="primary"
        style={{ padding: "10px 20px", marginTop: "10px" }}
      >
        Save Template
      </button>
    </div>
  );
};

export default SettingsDetail;
