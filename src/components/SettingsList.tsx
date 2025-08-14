import React, { useState } from "react";
import { Template, TemplateType, LayoutType } from "../types";
import "../App.css"; // Ensure global styles are applied

interface SettingsListProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onAddTemplate: (newTemplateData: {
    name: string;
    type: TemplateType;
    color: string;
  }) => void;
  onDeleteTemplate: (templateId: string) => void;
}

const SettingsList: React.FC<SettingsListProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onAddTemplate,
  onDeleteTemplate,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<TemplateType>("text");
  const [newColor, setNewColor] = useState("#ffffff");

  const handleAddNewTemplate = () => {
    if (!newName.trim()) {
      alert("Template name is required.");
      return;
    }
    onAddTemplate({
      name: newName,
      type: newType,
      color: newColor,
    });
    setIsAdding(false);
    setNewName("");
    setNewType("text");
    setNewColor("#ffffff");
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <h4>Templates</h4>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            style={{ width: "100%", marginTop: "10px" }}
          >
            ＋ Add New Template
          </button>
        )}
      </div>

      {isAdding && (
        <div
          className="add-template-form"
          style={{
            marginTop: "15px",
            borderTop: "1px solid var(--app-border-color)",
            paddingTop: "15px",
          }}
        >
          <h4>New Template Details</h4>
          <input
            type="text"
            placeholder="Template Name*"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as TemplateType)}
          >
            <option value="text">Text</option>
          </select>
          <label
            htmlFor="template-color-new"
            style={{ display: "block", marginTop: "5px" }}
          >
            Color:
          </label>
          <input
            type="color"
            id="template-color-new"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            style={{ marginLeft: "5px" }}
          />
          <button
            onClick={handleAddNewTemplate}
            className="primary"
            style={{ marginRight: "5px" }}
          >
            Save Template
          </button>
          <button onClick={() => setIsAdding(false)}>Cancel</button>
        </div>
      )}

      <ul
        style={{
          listStyleType: "none",
          padding: 0,
          margin: 0,
          border: "1px solid var(--app-border-color)",
          borderRadius: "4px",
        }}
      >
        {templates.length === 0 && !isAdding && (
          <li
            className="list-item"
            style={{ color: "var(--app-text-color-secondary)" }}
          >
            No templates. Click + to add.
          </li>
        )}
        {templates.map((template) => (
          <li
            key={template.id}
            className={`template-item ${
              template.id === selectedTemplateId ? "selected" : ""
            }`}
            onClick={() => onSelectTemplate(template.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  backgroundColor: template.color,
                  marginRight: "8px",
                  border: "1px solid var(--app-border-color)",
                  borderRadius: "3px",
                }}
              ></span>
              {template.name}
              <span
                style={{
                  fontSize: "0.8em",
                  marginLeft: "5px",
                  color:
                    template.id === selectedTemplateId
                      ? "var(--app-list-item-selected-text)"
                      : "var(--app-text-color-secondary)",
                }}
              >
                ({template.type})
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  window.confirm(
                    `Are you sure you want to delete template "${template.name}"?`
                  )
                ) {
                  onDeleteTemplate(template.id);
                }
              }}
              title="Delete template"
              style={{
                padding: "3px 8px",
                fontSize: "0.8em",
                background: "transparent",
                color: "var(--app-text-color-secondary)",
              }}
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SettingsList;
