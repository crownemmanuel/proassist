import React, { useEffect, useState } from "react";
import { TemplateType } from "../types";

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (newTemplateData: {
    name: string;
    type: TemplateType;
    color: string;
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

  useEffect(() => {
    if (isOpen) {
      setName("");
      setType("text");
      setColor("#4caf50");
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Template name is required.");
      return;
    }
    onAddTemplate({ name, type, color });
    onClose();
  };

  if (!isOpen) return null;

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
          <label htmlFor="tpl-type">Type</label>
          <select
            id="tpl-type"
            value={type}
            onChange={(e) => setType(e.target.value as TemplateType)}
          >
            <option value="text">Text</option>
          </select>
        </div>
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

