/**
 * SmartVerses Types
 * 
 * Type definitions for the SmartVerses smart Bible lookup feature.
 */

// =============================================================================
// TRANSCRIPTION TYPES
// =============================================================================

export type TranscriptionEngine = 'assemblyai' | 'elevenlabs' | 'whisper';

export type AudioCaptureMode = 'webrtc' | 'native';

export interface TranscriptionConfig {
  engine: TranscriptionEngine;
  apiKey: string;
  sampleRate?: number;
  language?: string;
}

export interface TranscriptionSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface TranscriptionCallbacks {
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string, segment: TranscriptionSegment) => void;
  onError?: (error: Error) => void;
  onConnectionClose?: (code: number, reason: string) => void;
  onStatusChange?: (status: TranscriptionStatus) => void;
  onAudioLevel?: (level: number) => void;
}

export type TranscriptionStatus = 'idle' | 'connecting' | 'recording' | 'error' | 'waiting_for_browser';

// =============================================================================
// BIBLE REFERENCE TYPES
// =============================================================================

export interface ParsedBibleReference {
  book: string;
  fullBookName: string;
  chapter: number;
  endChapter?: number;
  startVerse: number;
  endVerse: number;
  translation: string;
  displayRef: string; // Human-readable reference like "John 3:16"
}

export interface BibleParseContext {
  book: string | null;
  chapter: number | null;
  verse: number | null;
  endChapter?: number | null;
  endVerse?: number | null;
  fullReference: string | null;
}

// =============================================================================
// AI ANALYSIS TYPES
// =============================================================================

export interface ParaphrasedVerse {
  reference: string;        // e.g., "John 3:16"
  confidence: number;       // 0.0 to 1.0
  matchedPhrase: string;    // Portion of transcript that matches
  verseText?: string;       // The actual verse text (looked up)
}

export type KeyPointCategory = 'quote' | 'action' | 'principle' | 'encouragement';

export interface KeyPoint {
  text: string;
  category: KeyPointCategory;
}

export interface TranscriptAnalysisResult {
  paraphrasedVerses: ParaphrasedVerse[];
  keyPoints: KeyPoint[];
}

// =============================================================================
// DETECTED REFERENCE TYPES (for display)
// =============================================================================

export type DetectedReferenceSource = 'direct' | 'paraphrase';

export interface DetectedBibleReference {
  id: string;
  reference: string;        // e.g., "John 3:16"
  displayRef: string;       // Human-readable reference
  verseText: string;        // The verse text
  source: DetectedReferenceSource;
  confidence?: number;      // For paraphrased references
  matchedPhrase?: string;   // For paraphrased references
  transcriptText?: string;  // The transcript text that contained this reference
  timestamp: number;
  // Verse components for navigation
  book?: string;
  chapter?: number;
  verse?: number;
  // Navigation tracking - true if this verse was loaded via prev/next navigation
  isNavigationResult?: boolean;
}

// =============================================================================
// CHAT/SEARCH TYPES
// =============================================================================

export interface BibleSearchQuery {
  id: string;
  query: string;
  timestamp: number;
  isAISearch: boolean;
}

export interface BibleSearchResult {
  id: string;
  queryId: string;
  references: DetectedBibleReference[];
  timestamp: number;
  error?: string;
}

export interface SmartVersesChatMessage {
  id: string;
  type: 'query' | 'result' | 'system';
  content: string;
  timestamp: number;
  references?: DetectedBibleReference[];
  isLoading?: boolean;
  error?: string;
}

// =============================================================================
// SETTINGS TYPES
// =============================================================================

export interface SmartVersesSettings {
  // Transcription settings
  transcriptionEngine: TranscriptionEngine;
  assemblyAIApiKey?: string;
  selectedMicrophoneId?: string;
  audioCaptureMode?: AudioCaptureMode;
  selectedNativeMicrophoneId?: string;
  streamTranscriptionsToWebSocket: boolean;
  runTranscriptionInBrowser?: boolean; // When true, opens external browser for transcription
  remoteTranscriptionEnabled?: boolean;
  remoteTranscriptionHost?: string;
  remoteTranscriptionPort?: number;
  transcriptionTimeLimitMinutes?: number; // Auto-stop prompt threshold (default: 120)
  
  // AI Search settings
  enableAISearch: boolean;
  bibleSearchProvider?: 'openai' | 'gemini' | 'groq';
  bibleSearchModel?: string;
  
  // AI Detection settings (for transcription)
  enableParaphraseDetection: boolean;
  enableKeyPointExtraction: boolean;
  keyPointExtractionInstructions?: string;
  paraphraseConfidenceThreshold: number; // Default 0.6
  aiMinWordCount: number; // Default 6
  
  // Display settings
  autoAddDetectedToHistory: boolean; // Add detected refs from transcription to chat history
  highlightDirectReferences: boolean;
  highlightParaphrasedReferences: boolean;
  directReferenceColor: string;      // Default pink/magenta
  paraphraseReferenceColor: string;  // Default blue
  
  // ProPresenter integration
  autoTriggerOnDetection: boolean;
  proPresenterActivation?: {
    presentationUuid: string;
    slideIndex: number;
    presentationName?: string;
    activationClicks?: number;   // Number of clicks when going live (default: 1)
    takeOffClicks?: number;      // Number of clicks when taking off live (default: 0)
    clearTextFileOnTakeOff?: boolean; // Whether to clear text files when taking off live (default: true)
  };
  proPresenterConnectionIds?: string[];
  selectedProPresenterConnectionId?: string; // The connection to use for Get Slide
  
  // Output settings
  bibleOutputPath?: string;
  bibleTextFileName?: string;
  bibleReferenceFileName?: string;
  clearTextAfterLive?: boolean;
  clearTextDelay?: number;
}

export const DEFAULT_SMART_VERSES_SETTINGS: SmartVersesSettings = {
  transcriptionEngine: 'assemblyai',
  audioCaptureMode: 'webrtc',
  streamTranscriptionsToWebSocket: true,
  remoteTranscriptionEnabled: false,
  remoteTranscriptionHost: "",
  remoteTranscriptionPort: 9876,
  transcriptionTimeLimitMinutes: 120,
  enableAISearch: false, // Off by default - uses text search instead
  bibleSearchProvider: 'groq',
  bibleSearchModel: 'llama-3.3-70b-versatile',
  enableParaphraseDetection: true,
  enableKeyPointExtraction: false,
  keyPointExtractionInstructions:
    "Extract 1–2 concise, quotable key points suitable for slides/lower-thirds. Prefer short sentences, avoid filler, keep the original voice, and skip vague statements.",
  paraphraseConfidenceThreshold: 0.6,
  aiMinWordCount: 6,
  autoAddDetectedToHistory: false,
  highlightDirectReferences: true,
  highlightParaphrasedReferences: true,
  directReferenceColor: '#ec4899', // Pink
  paraphraseReferenceColor: '#3b82f6', // Blue
  autoTriggerOnDetection: false,
  clearTextAfterLive: true,
  clearTextDelay: 0,
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const SMART_VERSES_SETTINGS_KEY = 'proassist-smartverses-settings';
export const SMART_VERSES_CHAT_HISTORY_KEY = 'proassist-smartverses-chat-history';
