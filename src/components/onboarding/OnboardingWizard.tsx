/**
 * Main Onboarding Wizard Component
 * Orchestrates the flow through all onboarding screens
 */

import React, { useState, useEffect } from "react";
import {
  OnboardingState,
  OnboardingScreen,
  loadOnboardingState,
  saveOnboardingState,
  markOnboardingCompleted,
  markOnboardingSkipped,
} from "../../types/onboarding";
import WelcomeScreen from "./WelcomeScreen";
import SmartVersesIntroScreen from "./SmartVersesIntroScreen";
import TranscriptionProviderScreen from "./TranscriptionProviderScreen";
import AssemblyAISetupScreen from "./AssemblyAISetupScreen";
import GroqSetupScreen from "./GroqSetupScreen";
import OfflineModelSetupScreen from "./OfflineModelSetupScreen";
import ParaphrasingSetupScreen from "./ParaphrasingSetupScreen";
import MicSetupScreen from "./MicSetupScreen";
import TestSmartVersesScreen from "./TestSmartVersesScreen";
import TestKeypointScreen from "./TestKeypointScreen";
import AdditionalFeaturesScreen from "./AdditionalFeaturesScreen";
import "./onboarding.css";

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const [state, setState] = useState<OnboardingState>(() =>
    loadOnboardingState()
  );

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveOnboardingState(state);
  }, [state]);

  const updateState = (updates: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const goToScreen = (screen: OnboardingScreen) => {
    updateState({ currentScreen: screen });
  };

  const handleNext = (nextScreen: OnboardingScreen) => {
    goToScreen(nextScreen);
  };

  const handleBack = (previousScreen: OnboardingScreen) => {
    goToScreen(previousScreen);
  };

  const handleSkip = () => {
    markOnboardingSkipped();
    onSkip();
  };

  const handleFinish = () => {
    markOnboardingCompleted();
    onComplete();
  };

  // Render current screen
  const renderScreen = () => {
    switch (state.currentScreen) {
      case "welcome":
        return (
          <WelcomeScreen
            onNext={() => handleNext("smart-verses-intro")}
            onSkip={handleSkip}
          />
        );

      case "smart-verses-intro":
        return (
          <SmartVersesIntroScreen
            enabled={state.smartVersesEnabled}
            onToggle={(enabled) => updateState({ smartVersesEnabled: enabled })}
            onNext={() => {
              if (state.smartVersesEnabled) {
                handleNext("transcription-provider");
              } else {
                // Skip Smart Verses setup if disabled
                handleNext("additional-features");
              }
            }}
            onBack={() => handleBack("welcome")}
            onSkip={handleSkip}
          />
        );

      case "transcription-provider":
        return (
          <TranscriptionProviderScreen
            selectedProvider={state.transcriptionProvider}
            onSelectProvider={(provider) => {
              updateState({ transcriptionProvider: provider });
              // Route to appropriate setup screen
              if (provider === "assemblyai") {
                handleNext("assemblyai-setup");
              } else if (provider === "groq") {
                handleNext("groq-setup");
              } else if (
                provider === "offline-whisper" ||
                provider === "offline-moonshine"
              ) {
                handleNext("offline-model-setup");
              }
            }}
            onBack={() => handleBack("smart-verses-intro")}
            onSkip={() => {
              updateState({ transcriptionConfigured: false });
              handleNext("paraphrasing-setup");
            }}
          />
        );

      case "assemblyai-setup":
        return (
          <AssemblyAISetupScreen
            apiKey={state.assemblyAIKey}
            onApiKeyChange={(key) => updateState({ assemblyAIKey: key })}
            onNext={() => {
              updateState({ transcriptionConfigured: !!state.assemblyAIKey });
              handleNext("paraphrasing-setup");
            }}
            onBack={() => handleBack("transcription-provider")}
            onSkip={() => {
              updateState({ transcriptionConfigured: false });
              handleNext("paraphrasing-setup");
            }}
          />
        );

      case "groq-setup":
        return (
          <GroqSetupScreen
            apiKey={state.groqKey}
            onApiKeyChange={(key) => updateState({ groqKey: key })}
            onNext={() => {
              const configured = !!state.groqKey;
              updateState({
                transcriptionConfigured: configured,
                paraphrasingConfigured: configured,
              });
              // Skip paraphrasing setup since Groq handles both
              handleNext("mic-setup");
            }}
            onBack={() => handleBack("transcription-provider")}
            onSkip={() => {
              updateState({
                transcriptionConfigured: false,
                paraphrasingConfigured: false,
              });
              handleNext("paraphrasing-setup");
            }}
          />
        );

      case "offline-model-setup":
        return (
          <OfflineModelSetupScreen
            modelType={
              state.transcriptionProvider === "offline-whisper"
                ? "whisper"
                : "moonshine"
            }
            onNext={() => {
              updateState({ transcriptionConfigured: true });
              handleNext("paraphrasing-setup");
            }}
            onBack={() => handleBack("transcription-provider")}
            onSkip={() => {
              updateState({ transcriptionConfigured: false });
              handleNext("paraphrasing-setup");
            }}
          />
        );

      case "paraphrasing-setup":
        return (
          <ParaphrasingSetupScreen
            provider={state.paraphrasingProvider}
            onProviderChange={(provider) =>
              updateState({ paraphrasingProvider: provider })
            }
            onNext={() => {
              updateState({
                paraphrasingConfigured: !!state.paraphrasingProvider,
              });
              handleNext("mic-setup");
            }}
            onBack={() => {
              // Determine where to go back based on transcription provider
              if (state.transcriptionProvider === "groq") {
                handleBack("groq-setup");
              } else if (state.transcriptionProvider === "assemblyai") {
                handleBack("assemblyai-setup");
              } else if (
                state.transcriptionProvider === "offline-whisper" ||
                state.transcriptionProvider === "offline-moonshine"
              ) {
                handleBack("offline-model-setup");
              } else {
                handleBack("transcription-provider");
              }
            }}
            onSkip={() => {
              updateState({ paraphrasingConfigured: false });
              handleNext("mic-setup");
            }}
          />
        );

      case "mic-setup":
        return (
          <MicSetupScreen
            selectedMicId={state.selectedMicId}
            onMicSelect={(micId) => updateState({ selectedMicId: micId })}
            onNext={() => {
              updateState({ micConfigured: !!state.selectedMicId });
              handleNext("test-smart-verses");
            }}
            onBack={() => handleBack("paraphrasing-setup")}
            onSkip={() => {
              updateState({ micConfigured: false });
              handleNext("test-smart-verses");
            }}
          />
        );

      case "test-smart-verses":
        return (
          <TestSmartVersesScreen
            transcriptionConfigured={state.transcriptionConfigured}
            paraphrasingConfigured={state.paraphrasingConfigured}
            micConfigured={state.micConfigured}
            onTestKeypoint={() => handleNext("test-keypoint")}
            onNext={() => handleNext("additional-features")}
            onBack={() => handleBack("mic-setup")}
            onSkip={() => handleNext("additional-features")}
          />
        );

      case "test-keypoint":
        return (
          <TestKeypointScreen
            transcriptionConfigured={state.transcriptionConfigured}
            paraphrasingConfigured={state.paraphrasingConfigured}
            micConfigured={state.micConfigured}
            onBack={() => handleBack("test-smart-verses")}
            onSkip={() => handleNext("test-smart-verses")}
          />
        );

      case "additional-features":
        return (
          <AdditionalFeaturesScreen
            smartTimersEnabled={state.smartTimersEnabled}
            smartSlidesEnabled={state.smartSlidesEnabled}
            recorderEnabled={state.recorderEnabled}
            liveTestimoniesEnabled={state.liveTestimoniesEnabled}
            onToggle={(feature, enabled) => {
              updateState({ [feature]: enabled });
            }}
            onFinish={handleFinish}
            onBack={() => {
              if (state.smartVersesEnabled) {
                handleBack("test-smart-verses");
              } else {
                handleBack("smart-verses-intro");
              }
            }}
            onSkip={handleSkip}
          />
        );

      default:
        return (
          <div className="onboarding-error">
            <p>Unknown screen: {state.currentScreen}</p>
            <button onClick={() => goToScreen("welcome")}>Start Over</button>
          </div>
        );
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">{renderScreen()}</div>
    </div>
  );
};

export default OnboardingWizard;
