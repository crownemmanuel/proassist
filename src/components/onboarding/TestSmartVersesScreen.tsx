/**
 * Screen 9: Test Smart Verses
 */

import React, { useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa";
import "./onboarding.css";

interface TestSmartVersesScreenProps {
  transcriptionConfigured: boolean;
  paraphrasingConfigured: boolean;
  micConfigured: boolean;
  onTestKeypoint: () => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const TestSmartVersesScreen: React.FC<TestSmartVersesScreenProps> = ({
  transcriptionConfigured,
  paraphrasingConfigured,
  micConfigured,
  onTestKeypoint,
  onNext,
  onBack,
  onSkip,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    verse?: string;
    paraphrase?: string;
  }>({});

  const canTest =
    transcriptionConfigured && paraphrasingConfigured && micConfigured;

  const handleStartTest = () => {
    setTesting(true);
    // In a real implementation, this would start transcription and verse detection
    // For now, we'll just simulate it
    setTimeout(() => {
      setTestResults({
        verse: "John 3:16",
        paraphrase: "God's love for the world",
      });
      setTesting(false);
    }, 3000);
  };

  const handleStopTest = () => {
    setTesting(false);
    setTestResults({});
  };

  return (
    <div className="onboarding-screen">
      <div className="onboarding-content">
        <h1 className="onboarding-title">Test Smart Verses</h1>
        <p className="onboarding-body">
          Let's test scripture detection and paraphrase recognition. Click "Start
          Test" and say a Bible verse or paraphrase one.
        </p>

        {!canTest ? (
          <div className="onboarding-message onboarding-message-warning">
            <strong>Testing is unavailable</strong>
            <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
              Smart Verses tests are unavailable because transcription and/or
              paraphrasing and/or microphone setup is incomplete. You can
              complete the setup from Settings later.
            </p>
          </div>
        ) : (
          <>
            {/* Test Controls */}
            <div
              style={{
                padding: "var(--spacing-4)",
                background: "var(--surface-2)",
                borderRadius: "12px",
                border: "1px solid var(--app-border-color)",
              }}
            >
              <h3 style={{ margin: "0 0 var(--spacing-3)" }}>
                Scripture Detection Test
              </h3>
              <p style={{ margin: "0 0 var(--spacing-3)", fontSize: "0.9rem" }}>
                Try saying: "For God so loved the world that he gave his only
                begotten Son..."
              </p>

              {!testing ? (
                <button
                  onClick={handleStartTest}
                  className="onboarding-button onboarding-button-primary"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <FaPlay />
                  Start Test
                </button>
              ) : (
                <button
                  onClick={handleStopTest}
                  className="onboarding-button onboarding-button-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <FaStop />
                  Stop Test
                </button>
              )}

              {testing && (
                <div className="onboarding-message onboarding-message-info">
                  <span className="onboarding-spinner"></span>
                  Listening for scripture...
                </div>
              )}

              {testResults.verse && (
                <div className="onboarding-message onboarding-message-success">
                  <strong>Detected verse:</strong> {testResults.verse}
                </div>
              )}
            </div>

            {/* Paraphrase Test */}
            <div
              style={{
                padding: "var(--spacing-4)",
                background: "var(--surface-2)",
                borderRadius: "12px",
                border: "1px solid var(--app-border-color)",
              }}
            >
              <h3 style={{ margin: "0 0 var(--spacing-3)" }}>
                Paraphrase Detection Test
              </h3>
              <p style={{ margin: "0 0 var(--spacing-3)", fontSize: "0.9rem" }}>
                Try saying: "God loved us so much that he sent his Son to save
                us..."
              </p>

              {testResults.paraphrase && (
                <div className="onboarding-message onboarding-message-success">
                  <strong>Detected paraphrase:</strong> {testResults.paraphrase}
                </div>
              )}
            </div>
          </>
        )}

        {/* Additional Test Button */}
        {canTest && (
          <button
            onClick={onTestKeypoint}
            className="onboarding-button onboarding-button-secondary"
            style={{ width: "100%" }}
          >
            Test keypoint extraction
          </button>
        )}

        <p className="onboarding-help-text">
          You can run more comprehensive tests from the Smart Verses page after
          onboarding.
        </p>

        <div className="onboarding-buttons">
          <button
            onClick={onNext}
            className="onboarding-button onboarding-button-primary"
          >
            {canTest ? "Done" : "Next"}
          </button>
          <button
            onClick={onBack}
            className="onboarding-button onboarding-button-secondary"
          >
            Back
          </button>
          <button
            onClick={onSkip}
            className="onboarding-button onboarding-button-tertiary"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestSmartVersesScreen;
