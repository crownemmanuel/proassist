# ProAssist Onboarding System

## Overview

The ProAssist onboarding wizard guides new users through setting up the application's features, with a focus on the Smart Verses transcription and AI capabilities.

## Features

- **Multi-screen wizard flow** with 11+ screens
- **Smart navigation** that adapts based on user choices
- **Configuration persistence** to localStorage
- **Settings synchronization** with existing Settings page
- **Skip functionality** on every screen
- **Provider selection** for transcription (Cloud/Free/Offline)
- **API key testing** for cloud providers
- **Microphone setup** with permission handling
- **Feature testing** screens with real-time feedback
- **Keypoint extraction** testing
- **Additional features** configuration

## Architecture

### Core Files

#### Types
- `src/types/onboarding.ts` - TypeScript types and state management functions
  - `OnboardingState` - Main state interface
  - `OnboardingScreen` - Screen identifier type
  - Helper functions: `loadOnboardingState()`, `saveOnboardingState()`, `isOnboardingCompleted()`, etc.

#### Main Component
- `src/components/onboarding/OnboardingWizard.tsx` - Main orchestrator component
  - Manages screen navigation
  - Handles state updates
  - Routes to appropriate screens based on user selections

#### Individual Screen Components
All located in `src/components/onboarding/`:

1. **WelcomeScreen.tsx** - Welcome with ProAssist branding
2. **SmartVersesIntroScreen.tsx** - Introduce Smart Verses with toggle
3. **TranscriptionProviderScreen.tsx** - Provider selection (Cloud/Free/Offline tabs)
4. **AssemblyAISetupScreen.tsx** - AssemblyAI API key setup with testing
5. **GroqSetupScreen.tsx** - Groq API key setup with testing
6. **OfflineModelSetupScreen.tsx** - Download offline models (Whisper/Moonshine)
7. **ParaphrasingSetupScreen.tsx** - AI provider selection for paraphrasing
8. **MicSetupScreen.tsx** - Microphone selection and permissions
9. **TestSmartVersesScreen.tsx** - Test scripture detection and paraphrasing
10. **TestKeypointScreen.tsx** - Test keypoint extraction from sermon audio
11. **AdditionalFeaturesScreen.tsx** - Enable/disable other ProAssist features

#### Styles
- `src/components/onboarding/onboarding.css` - Complete styling for all screens

## Screen Flow

```
Welcome
  ↓
Smart Verses Intro (with toggle)
  ↓ (if enabled)           ↓ (if disabled)
Transcription Provider → Additional Features
  ↓ (based on selection)
  ├─ AssemblyAI Setup → Paraphrasing Setup
  ├─ Groq Setup → Mic Setup (skips paraphrasing, Groq handles both)
  └─ Offline Model → Paraphrasing Setup
       ↓
Mic Setup
  ↓
Test Smart Verses (with keypoint test button)
  ↓ (optional)
Test Keypoint Extraction
  ↓
Additional Features → Complete!
```

## State Management

### OnboardingState Interface

```typescript
{
  currentScreen: OnboardingScreen;
  smartVersesEnabled: boolean;
  transcriptionConfigured: boolean;
  paraphrasingConfigured: boolean;
  micConfigured: boolean;
  transcriptionProvider?: "assemblyai" | "groq" | "offline-whisper" | "offline-moonshine";
  paraphrasingProvider?: "openai" | "gemini" | "groq";
  assemblyAIKey?: string;
  groqKey?: string;
  selectedMicId?: string;
  smartTimersEnabled: boolean;
  smartSlidesEnabled: boolean;
  recorderEnabled: boolean;
  liveTestimoniesEnabled: boolean;
  completed: boolean;
  completedAt?: number;
  skipped: boolean;
}
```

### Storage

- State is persisted to localStorage under key: `proassist-onboarding-state`
- Settings are synced to their respective configuration stores:
  - Smart Verses settings → `loadSmartVersesSettings()` / `saveSmartVersesSettings()`
  - AI configuration → `getAppSettings()` / `saveAppSettings()`
  - Features → `loadEnabledFeatures()` / `saveEnabledFeatures()`

## Integration with App

The onboarding wizard is integrated into `App.tsx`:

```typescript
const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
  return isMainWindow && !isOnboardingCompleted();
});

if (showOnboarding) {
  return (
    <OnboardingWizard
      onComplete={handleOnboardingComplete}
      onSkip={handleOnboardingSkip}
    />
  );
}
```

## Key Features

### 1. Smart Provider Selection

The transcription provider screen uses icon-based tabs:
- **Cloud** tab: Shows AssemblyAI (recommended, most accurate)
- **Free** tab: Shows Groq (cloud, free) + Offline models (Whisper, Moonshine)
- **Offline** tab: Shows only offline models for privacy-conscious users

### 2. API Key Testing

Both AssemblyAI and Groq setup screens include:
- Password-masked input fields
- "Test API key" button with real validation
- Success/error status display
- Links to provider dashboards
- Important notes about credits/limits

### 3. Offline Model Management

- Shows available models with size info
- Downloads models with progress tracking
- Integrates with existing `offlineModelPreloadService`
- Saves selected model to Smart Verses settings

### 4. Microphone Setup

- Requests microphone permission
- Enumerates available audio input devices
- Auto-selects default microphone
- Saves selection to Smart Verses settings

### 5. Testing Screens

**Test Smart Verses:**
- Tests scripture detection (direct references)
- Tests paraphrase detection
- Shows "test unavailable" message if prerequisites not met
- Button to access keypoint extraction test

**Test Keypoint Extraction:**
- Provides example text to read
- Records short audio sample
- Extracts and displays main keypoint
- Shows that result is based on actual speech, not example

### 6. Skip Behavior

Every screen has "Skip for now" button:
- Tracks configuration flags (`transcriptionConfigured`, etc.)
- Shows appropriate warnings in test screens
- Allows completing onboarding without full setup
- User can complete setup later in Settings

## CSS Design

The onboarding uses a modern, clean design:
- Full-screen overlay
- Smooth animations (fadeIn, slideIn)
- Split-screen layouts for visual + content
- Icon-based tabs
- Card-based selection UI
- Custom toggle switches
- Status messages (success, error, info, warning)
- Responsive design

## Development

### Adding a New Screen

1. Create component in `src/components/onboarding/NewScreen.tsx`
2. Add screen identifier to `OnboardingScreen` type
3. Add routing logic in `OnboardingWizard.tsx`
4. Update screen flow documentation
5. Export from `src/components/onboarding/index.ts`

### Testing

To test the onboarding flow:

```typescript
// In browser console
localStorage.removeItem('proassist-onboarding-state');
location.reload();
```

Or use the utility function:

```typescript
import { resetOnboardingState } from './types/onboarding';
resetOnboardingState();
```

## Settings Synchronization

All onboarding choices sync with Settings page:

- **Smart Verses Settings**
  - Transcription engine
  - API keys (AssemblyAI, Groq)
  - Selected microphone
  - Offline model selection
  - Bible search provider

- **AI Configuration**
  - Groq API key (for paraphrasing)
  - Provider selection

- **Features Settings**
  - Smart Verses enabled
  - Smart Timers enabled
  - Smart Slides enabled
  - Recorder enabled
  - Live Testimonies enabled

## Future Enhancements

Potential improvements:

1. **Progress Indicator** - Visual progress bar showing completion percentage
2. **Animated Visuals** - Replace placeholder GIFs with actual animations
3. **Video Tutorials** - Embed short video clips explaining features
4. **Tooltips** - Context-sensitive help throughout the wizard
5. **Re-onboarding** - Allow users to restart onboarding from Settings
6. **Feature Discovery** - Highlight new features in updates
7. **Import/Export Settings** - Quick setup for multiple machines

## Troubleshooting

### Onboarding Shows on Every Launch

Check if `localStorage` is being cleared. Verify:

```typescript
console.log(localStorage.getItem('proassist-onboarding-state'));
```

Should show JSON with `completed: true` or `skipped: true`.

### Settings Not Persisting

Check that all save functions are called:
- `saveSmartVersesSettings()`
- `saveAppSettings()`
- `saveEnabledFeatures()`

### API Key Test Failing

- Verify network connectivity
- Check API key format
- Ensure provider account has credits (AssemblyAI)
- Check rate limits (Groq)

## Files Created

### New Files

1. `src/types/onboarding.ts` (175 lines)
2. `src/components/onboarding/OnboardingWizard.tsx` (273 lines)
3. `src/components/onboarding/onboarding.css` (482 lines)
4. `src/components/onboarding/WelcomeScreen.tsx` (56 lines)
5. `src/components/onboarding/SmartVersesIntroScreen.tsx` (95 lines)
6. `src/components/onboarding/TranscriptionProviderScreen.tsx` (173 lines)
7. `src/components/onboarding/AssemblyAISetupScreen.tsx` (172 lines)
8. `src/components/onboarding/GroqSetupScreen.tsx` (182 lines)
9. `src/components/onboarding/OfflineModelSetupScreen.tsx` (200 lines)
10. `src/components/onboarding/ParaphrasingSetupScreen.tsx` (149 lines)
11. `src/components/onboarding/MicSetupScreen.tsx` (167 lines)
12. `src/components/onboarding/TestSmartVersesScreen.tsx` (169 lines)
13. `src/components/onboarding/TestKeypointScreen.tsx` (187 lines)
14. `src/components/onboarding/AdditionalFeaturesScreen.tsx` (263 lines)
15. `src/components/onboarding/index.ts` (13 lines)
16. `docs/ONBOARDING.md` (this file)

### Modified Files

1. `src/App.tsx` - Added onboarding integration
2. `src/components/SlidesLayoutEditorModal.tsx` - Fixed TypeScript error

**Total: ~2,800+ lines of new code**

## Summary

The ProAssist onboarding system provides a comprehensive, user-friendly introduction to the application. It guides users through complex setup processes with clear instructions, real-time validation, and helpful feedback. The system is fully integrated with existing settings and maintains state across sessions.
