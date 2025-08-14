import React, { useEffect, useState } from "react";

interface RenameDialogProps {
  isOpen: boolean;
  title?: string;
  label?: string;
  initialValue: string;
  confirmText?: string;
  onSave: (newName: string) => void;
  onCancel: () => void;
}

const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  title = "Rename",
  label = "Name",
  initialValue,
  confirmText = "Save",
  onSave,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onSave(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div
        className="modal-content"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div className="form-group">
          <label htmlFor="rename-input">{label}:</label>
          <input
            id="rename-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={handleSubmit}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameDialog;
