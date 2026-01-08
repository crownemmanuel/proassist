import React, { useState } from "react";
import {
  generateJavaScriptAIPrompt,
  generateRegexAIPrompt,
} from "../utils/templateDefaults";
import "../App.css";

interface GenerateAIPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingType: "javascript" | "regex";
}

const GenerateAIPromptModal: React.FC<GenerateAIPromptModalProps> = ({
  isOpen,
  onClose,
  processingType,
}) => {
  const [userRequirements, setUserRequirements] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");

  const handleGenerateAndCopy = async () => {
    if (!userRequirements.trim()) {
      alert("Please describe what you want the function to do.");
      return;
    }

    let prompt: string;
    if (processingType === "javascript") {
      prompt = generateJavaScriptAIPrompt(userRequirements);
    } else {
      prompt = generateRegexAIPrompt(userRequirements);
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setCopyFeedback("✓ Prompt copied to clipboard!");
      setTimeout(() => {
        setCopyFeedback("");
        onClose();
        setUserRequirements("");
      }, 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
      setCopyFeedback("Failed to copy to clipboard");
      setTimeout(() => setCopyFeedback(""), 2000);
    }
  };

  const handleClose = () => {
    setUserRequirements("");
    setCopyFeedback("");
    onClose();
  };

  if (!isOpen) return null;

  const isJavaScript = processingType === "javascript";

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <h2>
          Generate AI Prompt for {isJavaScript ? "JavaScript" : "Regex"}
        </h2>

        <div className="form-group">
          <p
            style={{
              color: "var(--app-text-color-secondary)",
              fontSize: "0.9em",
              marginBottom: "15px",
            }}
          >
            Describe what you want the {isJavaScript ? "function" : "pattern"}{" "}
            to do. Be specific about:
          </p>
          <ul
            style={{
              color: "var(--app-text-color-secondary)",
              fontSize: "0.85em",
              marginBottom: "15px",
              paddingLeft: "20px",
            }}
          >
            {isJavaScript ? (
              <>
                <li>What format is your input text in?</li>
                <li>How should it be split into slides?</li>
                <li>
                  How many layers per slide? What goes in each layer?
                </li>
                <li>Any special handling needed (headers, references, etc.)?</li>
              </>
            ) : (
              <>
                <li>What format is your input text in?</li>
                <li>What should mark the split points?</li>
                <li>Should split markers be kept or removed?</li>
                <li>Any special patterns to match?</li>
              </>
            )}
          </ul>
        </div>

        <div className="form-group">
          <label htmlFor="user-requirements">Your Requirements:</label>
          <textarea
            id="user-requirements"
            rows={6}
            value={userRequirements}
            onChange={(e) => setUserRequirements(e.target.value)}
            placeholder={
              isJavaScript
                ? "Example: I have a list of hymns where each hymn starts with the hymn number and title on line 1, then verses below. Each hymn should become a slide with Layer 1 being the hymn title, Layer 2 being the first verse, Layer 3 being the chorus."
                : "Example: I want to split text by paragraph breaks (double newlines) so each paragraph becomes a separate slide."
            }
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>

        <div
          style={{
            backgroundColor: "var(--app-background-secondary)",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "15px",
          }}
        >
          <p
            style={{
              fontSize: "0.85em",
              color: "var(--app-text-color-secondary)",
              margin: 0,
            }}
          >
            💡 <strong>Tip:</strong> After copying the prompt, paste it into
            ChatGPT, Claude, Gemini, or any other AI assistant. Copy the{" "}
            {isJavaScript ? "JavaScript code" : "regex pattern"} it generates
            and paste it back here.
          </p>
        </div>

        {copyFeedback && (
          <p
            style={{
              color: "var(--app-primary-color)",
              textAlign: "center",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            {copyFeedback}
          </p>
        )}

        <div className="modal-actions">
          <button onClick={handleClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleGenerateAndCopy}
            disabled={!userRequirements.trim()}
          >
            📋 Generate & Copy Prompt
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateAIPromptModal;
