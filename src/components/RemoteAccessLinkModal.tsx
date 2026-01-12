import React, { useState, useEffect } from "react";
import { FaTimes, FaCopy, FaCheck, FaLink } from "react-icons/fa";
import { getLiveSlidesServerInfo } from "../services/liveSlideService";
import "../App.css";

interface RemoteAccessLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RemoteAccessLinkModal: React.FC<RemoteAccessLinkModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [remoteUrl, setRemoteUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      generateRemoteUrl();
    } else {
      setCopied(false);
      setError(null);
    }
  }, [isOpen]);

  const generateRemoteUrl = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const serverInfo = await getLiveSlidesServerInfo();

      if (!serverInfo.server_running) {
        setError("Server is not running. Please start the server first.");
        setIsLoading(false);
        return;
      }

      const url = `http://${serverInfo.local_ip}:${serverInfo.server_port}/schedule/view`;
      setRemoteUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate remote access link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-4)" }}>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
            <FaLink /> Remote Access Link
          </h2>
          <button
            onClick={onClose}
            className="icon-button"
            style={{ padding: "8px" }}
          >
            <FaTimes />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "var(--spacing-3)",
              backgroundColor: "rgba(179, 38, 30, 0.1)",
              border: "1px solid rgba(179, 38, 30, 0.3)",
              borderRadius: "6px",
              marginBottom: "var(--spacing-4)",
              color: "#b3261e",
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: "var(--spacing-4)", textAlign: "center" }}>
            Loading...
          </div>
        ) : (
          <>
            <p style={{ marginBottom: "var(--spacing-3)", color: "var(--app-text-color-secondary)" }}>
              Share this link with others to view the schedule remotely. The link will work on any device connected to the same network.
            </p>

            <div
              style={{
                display: "flex",
                gap: "var(--spacing-2)",
                alignItems: "center",
                padding: "var(--spacing-3)",
                backgroundColor: "var(--app-input-bg-color)",
                border: "1px solid var(--app-border-color)",
                borderRadius: "6px",
                marginBottom: "var(--spacing-4)",
              }}
            >
              <input
                type="text"
                value={remoteUrl}
                readOnly
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  color: "var(--app-text-color)",
                  fontSize: "0.9rem",
                  padding: 0,
                }}
              />
              <button
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  backgroundColor: copied ? "var(--app-live-indicator-color)" : "var(--app-primary-color)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {copied ? <FaCheck /> : <FaCopy />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div
              style={{
                padding: "var(--spacing-3)",
                backgroundColor: "rgba(0, 122, 204, 0.1)",
                border: "1px solid rgba(0, 122, 204, 0.3)",
                borderRadius: "6px",
                fontSize: "0.875rem",
                color: "var(--app-text-color-secondary)",
              }}
            >
              <strong>Note:</strong> Make sure your device and the viewing device are on the same network. The schedule will update automatically when changes are made.
            </div>
          </>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoteAccessLinkModal;
