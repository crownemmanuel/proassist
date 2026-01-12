import React, { useState, useEffect } from "react";
import { FirebaseConfig } from "../types/testimonies";
import { parseFirebaseConfig } from "../utils/firebaseConfigParser";
import "../App.css";

interface ImportFirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (config: FirebaseConfig) => void;
}

const ImportFirebaseConfigModal: React.FC<ImportFirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedConfig, setParsedConfig] = useState<FirebaseConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPastedText("");
      setError(null);
      setParsedConfig(null);
    }
  }, [isOpen]);

  const handleParse = () => {
    setError(null);
    setParsedConfig(null);

    if (!pastedText.trim()) {
      setError("Please paste your Firebase configuration");
      return;
    }

    try {
      const config = parseFirebaseConfig(pastedText);
      if (!config) {
        setError(
          "Could not parse Firebase configuration. Please ensure you've pasted either:\n" +
          "1. Environment variables (NEXT_PUBLIC_FIREBASE_API_KEY=...)\n" +
          "2. JavaScript object (const firebaseConfig = { ... })"
        );
        return;
      }

      // Check for missing required fields
      const requiredFields: (keyof FirebaseConfig)[] = [
        "apiKey",
        "authDomain",
        "databaseURL",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId",
      ];

      const missingFields = requiredFields.filter(
        (field) => !config[field] || config[field].trim() === ""
      );

      if (missingFields.length > 0) {
        setError(
          `Some required fields are missing: ${missingFields.join(", ")}. ` +
          "You can still import and fill them manually."
        );
      }

      setParsedConfig(config);
    } catch (err) {
      setError(
        `Failed to parse configuration: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleImport = () => {
    if (!parsedConfig) {
      setError("Please parse the configuration first");
      return;
    }

    onImport(parsedConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--app-bg-color)",
          borderRadius: "8px",
          padding: "var(--spacing-4)",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "var(--spacing-4)" }}>
          Import Firebase Configuration
        </h2>

        <p style={{ marginBottom: "var(--spacing-3)", fontSize: "0.9em", color: "var(--app-text-color-secondary)" }}>
          Paste your Firebase configuration in either format:
        </p>

        <div style={{ marginBottom: "var(--spacing-3)" }}>
          <div
            style={{
              padding: "var(--spacing-2)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "4px",
              fontSize: "0.85em",
              marginBottom: "var(--spacing-2)",
            }}
          >
            <strong>Format 1 - Environment Variables:</strong>
            <pre style={{ margin: "var(--spacing-1) 0 0 0", fontSize: "0.9em", whiteSpace: "pre-wrap" }}>
{`NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...`}
            </pre>
          </div>
          <div
            style={{
              padding: "var(--spacing-2)",
              backgroundColor: "var(--app-input-bg-color)",
              borderRadius: "4px",
              fontSize: "0.85em",
            }}
          >
            <strong>Format 2 - JavaScript Object:</strong>
            <pre style={{ margin: "var(--spacing-1) 0 0 0", fontSize: "0.9em", whiteSpace: "pre-wrap" }}>
{`const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  ...
};`}
            </pre>
          </div>
        </div>

        <div style={{ marginBottom: "var(--spacing-3)" }}>
          <label
            style={{
              display: "block",
              marginBottom: "var(--spacing-1)",
              fontWeight: 500,
            }}
          >
            Paste Configuration
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
              setError(null);
              setParsedConfig(null);
            }}
            placeholder="Paste your Firebase configuration here..."
            rows={12}
            style={{
              width: "100%",
              padding: "var(--spacing-2)",
              fontFamily: "monospace",
              fontSize: "0.9em",
              resize: "vertical",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              padding: "var(--spacing-2)",
              backgroundColor: "rgba(220, 38, 38, 0.1)",
              borderRadius: "4px",
              marginBottom: "var(--spacing-3)",
              color: "#dc2626",
              fontSize: "0.9em",
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        {parsedConfig && (
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              borderRadius: "4px",
              marginBottom: "var(--spacing-3)",
            }}
          >
            <p style={{ margin: "0 0 var(--spacing-2) 0", fontWeight: 500, color: "#22c55e" }}>
              ✓ Configuration parsed successfully!
            </p>
            <div style={{ fontSize: "0.85em", color: "var(--app-text-color-secondary)" }}>
              <div>API Key: {parsedConfig.apiKey ? "✓" : "✗"}</div>
              <div>Auth Domain: {parsedConfig.authDomain ? "✓" : "✗"}</div>
              <div>Database URL: {parsedConfig.databaseURL ? "✓" : "✗"}</div>
              <div>Project ID: {parsedConfig.projectId ? "✓" : "✗"}</div>
              <div>Storage Bucket: {parsedConfig.storageBucket ? "✓" : "✗"}</div>
              <div>Messaging Sender ID: {parsedConfig.messagingSenderId ? "✓" : "✗"}</div>
              <div>App ID: {parsedConfig.appId ? "✓" : "✗"}</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--spacing-2)", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="secondary">
            Cancel
          </button>
          <button onClick={handleParse} className="secondary">
            Parse
          </button>
          <button
            onClick={handleImport}
            disabled={!parsedConfig}
            className="primary"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportFirebaseConfigModal;
