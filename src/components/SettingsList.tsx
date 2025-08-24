import React, { useState } from "react";
import { Template, TemplateType } from "../types";
import { FaPlus, FaTimes } from "react-icons/fa";
import "../App.css"; // Ensure global styles are applied
import AddTemplateModal from "./AddTemplateModal";

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          gap: "8px",
        }}
      >
        <h4 style={{ margin: 0 }}>Templates</h4>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="secondary btn-sm"
        >
          <FaPlus />
          Add Template
        </button>
      </div>

      <ul
        style={{
          listStyleType: "none",
          padding: 0,
          margin: 0,
          border: "1px solid var(--app-border-color)",
          borderRadius: "4px",
        }}
      >
        {templates.length === 0 && (
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
            className={`list-item ${
              template.id === selectedTemplateId ? "selected" : ""
            }`}
            onClick={() => onSelectTemplate(template.id)}
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
              className="icon-button"
              style={{
                padding: "var(--spacing-1)",
                minWidth: "24px",
                minHeight: "24px",
              }}
            >
              <FaTimes />
            </button>
          </li>
        ))}
      </ul>

      <AddTemplateModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTemplate={(data) => {
          onAddTemplate(data);
          setIsAddModalOpen(false);
        }}
      />
    </div>
  );
};

export default SettingsList;
