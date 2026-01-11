import React, { useState } from "react";
import { FaCopy, FaCheck, FaDesktop } from "react-icons/fa";
import "../App.css";

interface TypingUrlModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

const TypingUrlModal: React.FC<TypingUrlModalProps> = ({
  isOpen,
  url,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access denied - user can still manually copy from the input
      console.error("Failed to copy:", err);
    }
  };

  const handleSelectAll = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FaDesktop style={{ color: "white", fontSize: "24px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              Live Slides Session Ready
            </h2>
            <p
              style={{
                margin: "4px 0 0 0",
                color: "var(--app-text-color-secondary)",
                fontSize: "0.9rem",
              }}
            >
              Share this URL with anyone who needs to type slides
            </p>
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 500,
              fontSize: "0.9rem",
            }}
          >
            Typing URL:
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={url}
              readOnly
              onClick={handleSelectAll}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid var(--app-border-color)",
                backgroundColor: "var(--app-input-bg-color)",
                color: "var(--app-text-color)",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                cursor: "text",
              }}
            />
            <button
              onClick={handleCopy}
              className={copied ? "primary" : "secondary"}
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
              title={copied ? "Copied!" : "Copy URL"}
            >
              {copied ? (
                <>
                  <FaCheck /> Copied!
                </>
              ) : (
                <>
                  <FaCopy /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "12px",
            backgroundColor: "var(--app-header-bg)",
            borderRadius: "6px",
            border: "1px solid var(--app-border-color)",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--app-text-color-secondary)",
              lineHeight: "1.5",
            }}
          >
            <strong>Tip:</strong> Paste this URL into a browser on any device on
            your network. The notepad will open and sync slides in real-time.
          </p>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TypingUrlModal;
