/**
 * Screen 2: Meet Smart Verses
 */

import React from "react";
import "./onboarding.css";

interface SmartVersesIntroScreenProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SmartVersesIntroScreen: React.FC<SmartVersesIntroScreenProps> = ({
  enabled,
  onToggle,
  onNext,
  onBack,
  onSkip,
}) => {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-split">
        {/* Visual side: Animated GIF or placeholder */}
        <div className="onboarding-visual">
          <div style={{ textAlign: "center", padding: "var(--spacing-5)" }}>
            {/* Placeholder for animated GIF */}
            <div
              style={{
                width: "100%",
                height: "300px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "var(--spacing-3)",
                color: "white",
              }}
            >
              <div style={{ fontSize: "3rem" }}>🎤</div>
              <div style={{ fontSize: "2rem" }}>📖</div>
              <div style={{ fontSize: "1.5rem" }}>✨</div>
              <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.9 }}>
                Smart Verses in action
              </p>
            </div>
          </div>
        </div>

        {/* Content side */}
        <div className="onboarding-content">
          <h1 className="onboarding-title">Meet Smart Verses</h1>
          <p className="onboarding-body">
            Smart Verses listens to your sermon or service in real time. Using
            AI, it detects scriptures when they are mentioned or paraphrased and
            can display them live to the audience. It also extracts key points
            from the sermon that can be displayed live or shared on social media.
          </p>

          {/* Toggle */}
          <div className="onboarding-toggle">
            <label className="onboarding-toggle-label" htmlFor="smart-verses-toggle">
              Enable Smart Verses
            </label>
            <label className="toggle-switch">
              <input
                id="smart-verses-toggle"
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <p className="onboarding-help-text">
            You can change this anytime from Settings.
          </p>

          <div className="onboarding-buttons">
            <button
              onClick={onNext}
              className="onboarding-button onboarding-button-primary"
            >
              Next
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
    </div>
  );
};

export default SmartVersesIntroScreen;
