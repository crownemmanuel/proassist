# ProCaster Bible App - Developer Notes

## Overview

This document provides comprehensive documentation for re-implementing the core features of the ProCaster Bible app in a new application without a render engine. The new app will focus on transcription, Bible reference detection, paraphrasing detection, key point extraction, and AI-powered Bible search.

**Important Note**: The new app will NOT have audience/stage display functionality. When Bible references are detected, the app should save them as a "presenter text file" and trigger a "presenter trigger" (your app will know what this means).

---

## Core Features

### 1. Live Transcription

#### Overview

The app uses AssemblyAI's Realtime API for live speech-to-text transcription. Audio is captured from the microphone, processed in real-time, and transcribed text is analyzed for Bible references.

#### Implementation Details

**Technology Stack:**

- **Service**: AssemblyAI Realtime API
- **Audio Recording**: RecordRTC library
- **Audio Format**: WebM with PCM codec, 16kHz sample rate, mono channel
- **Chunk Size**: 250ms time slices

**Key Components:**

1. **Token Generation**: Get temporary token from AssemblyAI (expires in 3600 seconds)
2. **WebSocket Connection**: Connect to AssemblyAI Realtime API
3. **Audio Capture**: Use RecordRTC to capture microphone audio
4. **Real-time Processing**: Send audio chunks to AssemblyAI as they're captured
5. **Transcript Events**: Handle interim and final transcript events

**Flow:**

```
1. User starts transcription
2. Get AssemblyAI token
3. Initialize RealtimeTranscriber
4. Get microphone access
5. Start RecordRTC with 250ms chunks
6. Send audio chunks to AssemblyAI via WebSocket
7. Receive interim transcripts (live updates)
8. Receive final transcripts (complete sentences)
9. Process final transcripts for Bible references
```

**Files:**

- `src/main/services/transcriptions.ts` - Token generation
- `src/renderer/components/LiveTranscriptionPanel.tsx` - Main transcription logic

**Key Functions:**

- `initializeTranscriptionIpc()` - Sets up IPC handler for token generation
- `startTranscription()` - Main transcription start function
- `endTranscription()` - Cleanup and stop transcription

**Note for New App**: When a Bible reference is detected in the transcript, save it to a presenter text file and trigger your presenter trigger mechanism.

---

### 2. Auto-Detection of Bible References

#### Overview

The app automatically detects Bible references in transcribed text using sophisticated parsing logic. It supports multiple formats including natural language, chapter-only, verse-only, and context-aware references.

#### Implementation Details

**Technology Stack:**

- **Parser Library**: `bible-passage-reference-parser` (bcv_parser)
- **Number Conversion**: `words-to-numbers` library
- **Context Tracking**: Custom global state management

**Key Features:**

1. **Context-Aware Parsing**

   - Tracks last parsed reference (book, chapter, verse)
   - Supports verse-only references ("verse 17" after "John 3:16")
   - Supports chapter-only references ("Matthew chapter 5" → "Matthew 5:1")

2. **Preprocessing**

   - Handles period-separated references: "Luke. Three. Three." → "Luke 3:3"
   - Converts written numbers to digits: "three" → "3"
   - Normalizes spacing and punctuation

3. **Supported Patterns:**
   - Standard: "John 3:16", "Romans 8:28-30"
   - Chapter-only: "Matthew chapter 5", "chapter 3 of John"
   - Verse-only: "verse 17", "from verse 18", "v 20"
   - Combined digits: "Luke 611" → "Luke 6:11"
   - Word-based: "John chapter three verse sixteen"

**Processing Pipeline:**

```
1. preprocessBibleReference() - Normalize periods and spacing
2. wordsToNumbers() - Convert written numbers to digits
3. Check for chapter+verse without book (use context)
4. Check for verse-only reference (use context)
5. Check for chapter-only reference (load verse 1)
6. Standard bcv.parse() - Full parsing
7. Update context for future references
```

**Files:**

- `src/main/services/bible.ts` - Main parsing logic
- `src/renderer/utils/bibleUtils.ts` - Renderer-side parsing utilities

**Key Functions:**

- `parseVerseReference(reference: string)` - Main parsing function
- `preprocessBibleReference(reference: string)` - Text normalization
- `isVerseOnlyReference(text: string)` - Detect verse-only patterns
- `isChapterOnlyReference(text: string)` - Detect chapter-only patterns

**Context Tracking:**

```typescript
let lastParsedContext = {
  book: null, // e.g., "John"
  chapter: null, // e.g., 3
  verse: null, // e.g., 16
  fullReference: null, // e.g., "John 3:16"
};
```

**Note for New App**: When a Bible reference is successfully parsed, save it to a presenter text file and trigger your presenter trigger.

---

### 3. Bible Pacer (Advanced Bible Reference Parser)

#### Overview

"Bible Pacer" refers to the sophisticated Bible reference parsing system that handles natural language, context-aware references, and transcription-style input. This is the core parsing engine.

#### Key Capabilities

1. **Natural Language Understanding**

   - Handles conversational references: "Turn with me to the book of Romans, chapter 8"
   - Supports filler words and hesitations
   - Handles period-separated speech-to-text output

2. **Context Preservation**

   - Maintains book/chapter context across multiple references
   - Enables verse-only navigation: "verse 17" after "John 3:16"
   - Switches context when new book is mentioned

3. **Multiple Reference Formats**

   - Colon format: "John 3:16"
   - Word format: "John chapter three verse sixteen"
   - Combined digits: "Luke 611" (chapter 6, verse 11)
   - Range support: "John 3:16-18"

4. **Error Recovery**
   - Falls back to context parsing if direct parse fails
   - Uses regex extraction as final fallback
   - Handles malformed references gracefully

**All Bible Pacer functions are extracted in:**

- `developer-notes/artifacts/bible-pacer-functions.ts`

**See artifacts folder for complete implementation.**

---

### 4. Detect Paraphrased Verses

#### Overview

Uses AI (Groq LLM) to detect when a speaker is paraphrasing or alluding to Bible verses without directly quoting them. This is useful for identifying indirect scriptural references in sermons.

#### Implementation Details

**Technology Stack:**

- **AI Provider**: Groq API (Llama 3.3 70B Versatile)
- **Framework**: LangChain
- **Model**: `llama-3.3-70b-versatile`
- **Temperature**: 0.7

**Process:**

1. Transcript chunk is sent to AI for analysis
2. AI identifies paraphrased verses with confidence scores
3. Results filtered by confidence threshold (>= 0.6)
4. Maximum 3 paraphrased verses returned per chunk
5. Minimum 10 words required for analysis

**AI Prompt Strategy:**

- Conservative approach - only clear paraphrases
- Returns reference, confidence score, and matched phrase
- Proper Bible reference format required

**Output Format:**

```typescript
interface ParaphrasedVerse {
  reference: string; // e.g., "John 3:16"
  confidence: number; // 0.0 to 1.0
  matchedPhrase: string; // Portion of transcript that matches
}
```

**Files:**

- `src/main/services/ai.ts` - AI analysis logic
- `src/renderer/components/LiveTranscriptionPanel.tsx` - Integration

**Key Functions:**

- `analyzeTranscriptChunk()` - Main analysis function
- `transcriptAnalysisChain` - LangChain pipeline

**Usage:**

- Only runs when `detectParaphrases` flag is enabled
- Processes final transcript chunks (not interim)
- Skips if direct Bible reference was already found

**Note for New App**: When paraphrased verses are detected, save them to presenter text file with their confidence scores and trigger presenter trigger.

**All paraphrase detection functions are extracted in:**

- `developer-notes/artifacts/bible-paraphrase-functions.ts`

---

### 5. Extract Key Points

#### Overview

Uses AI to extract quotable, actionable, or memorable statements from sermon transcripts. These are suitable for lower-thirds, social media quotes, or highlights.

#### Implementation Details

**Technology Stack:**

- Same as paraphrased verses (Groq + LangChain)

**Categories:**

- **quote**: Memorable, shareable statement
- **action**: Actionable step or call to action
- **principle**: Life principle or teaching point
- **encouragement**: Encouraging or uplifting statement

**Process:**

1. Transcript chunk analyzed by AI
2. AI extracts key points with categories
3. Maximum 2 key points per chunk
4. Minimum 10 words required for analysis
5. Only genuinely quotable content (not generic statements)

**Output Format:**

```typescript
interface KeyPoint {
  text: string;
  category: 'quote' | 'action' | 'principle' | 'encouragement';
}
```

**AI Prompt Strategy:**

- Focus on powerful declarative statements
- Actionable life principles
- Encouraging phrases
- Memorable one-liners
- Be selective - only truly quotable content

**Files:**

- `src/main/services/ai.ts` - Same as paraphrase detection
- `src/renderer/components/LiveTranscriptionPanel.tsx` - Integration

**Key Functions:**

- `analyzeTranscriptChunk()` - Same function, different output field
- Uses same LangChain pipeline

**Usage:**

- Only runs when `extractKeyPoints` flag is enabled
- Processes final transcript chunks
- Can run alongside paraphrase detection

**Note for New App**: When key points are extracted, save them to presenter text file with their categories and trigger presenter trigger.

**All key point extraction functions are extracted in:**

- `developer-notes/artifacts/bible-paraphrase-functions.ts` (same file as paraphrase detection)

---

### 6. AI Search for Bible Verses

#### Overview

Uses AI to understand natural language queries and find relevant Bible verses. This is useful when users ask questions like "What does the Bible say about love?" instead of specific references.

#### Implementation Details

**Technology Stack:**

- **AI Provider**: Groq API (Llama 3.3 70B Versatile)
- **Framework**: LangChain
- **Output Format**: JSON with verse references

**Process:**

1. User query sent to AI
2. AI analyzes query and identifies relevant Bible passages
3. Returns structured JSON with verse references
4. References can include highlight words for matching text

**Output Format:**

```json
{
  "verses": [
    {
      "reference": "John 3:16",
      "highlight": ["love", "world", "gave"]
    }
  ]
}
```

**Files:**

- `src/main/services/ai.ts` - AI query logic
- `src/renderer/components/BibleChatPanel.tsx` - UI integration

**Key Functions:**

- `generateBibleResponse(question: string)` - Main AI query function
- `chain` - LangChain pipeline for Bible queries

**Usage:**

- Falls back to AI search if direct Bible reference parsing fails
- Can be enabled/disabled via UI toggle
- Returns multiple verses when relevant

**Note for New App**: When AI finds verses, save them to presenter text file and trigger presenter trigger.

---

### 7. Anti-Bible Reference (Filtering)

#### Overview

The app filters out navigation commands and non-Bible content to avoid false positives when detecting Bible references.

#### Implementation Details

**Navigation Command Detection:**

- Detects voice commands like "next verse", "previous verse"
- Filters these out before Bible reference parsing
- Prevents navigation commands from being treated as Bible references

**Patterns Filtered:**

- "next verse", "next scripture", "next one"
- "previous verse", "previous scripture", "last verse"
- "go back", "go to next verse", "show next verse"

**Files:**

- `src/renderer/components/LiveTranscriptionPanel.tsx` - `checkForNavigationCommand()`

**Key Functions:**

- `checkForNavigationCommand(text: string)` - Detects navigation commands
- Returns `'next' | 'previous' | null`

**Note**: This prevents false positives but doesn't block legitimate Bible references that happen to contain these words.

---

## Data Flow

### Transcription → Detection → Action Flow

```
1. Audio Input
   ↓
2. AssemblyAI Transcription (interim + final)
   ↓
3. Final Transcript Received
   ↓
4. Check for Navigation Commands (filter out)
   ↓
5. Parse Bible References (parseBibleReferences + parseVerseReference)
   ↓
6a. If Reference Found:
    - Look up verse text
    - Save to presenter text file
    - Trigger presenter trigger
   ↓
6b. If No Reference Found AND AI Enabled:
    - Analyze with AI (paraphrase detection + key points)
    - If paraphrased verses found: Look up and save
    - If key points found: Save with categories
    - Trigger presenter trigger
```

---

## File Structure Reference

### Main Service Files

```
src/main/services/
├── bible.ts              # Bible parsing and reference detection
├── ai.ts                 # AI analysis (paraphrase + key points + search)
└── transcriptions.ts     # AssemblyAI transcription setup

src/renderer/
├── components/
│   ├── LiveTranscriptionPanel.tsx  # Main transcription UI/logic
│   └── BibleChatPanel.tsx          # AI search UI
└── utils/
    └── bibleUtils.ts     # Renderer-side parsing utilities
```

### Bible Data Files

```
assets/bibles/
├── bibleBookMapping.json  # Book name mappings
└── en_kjv.json           # Bible text data (JSON format)
```

### Verse Detector (Alternative Implementation)

```
bibleparaphraseer/verse-detector/
├── search.js      # Semantic search using embeddings
├── indexer.js     # Generate verse embeddings
└── embeddings/    # Pre-generated embeddings
```

---

## Environment Variables Required

```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
GROQ_API_KEY=your_groq_api_key
```

---

## Dependencies

### Core Dependencies

- `assemblyai` - Realtime transcription API
- `recordrtc` - Audio recording
- `bible-passage-reference-parser` - Bible reference parsing
- `words-to-numbers` - Convert written numbers to digits
- `@langchain/groq` - Groq AI integration
- `@langchain/core` - LangChain core utilities
- `flexsearch` - Full-text search for Bible content

### Optional (for verse detector alternative)

- `@xenova/transformers` - Embedding generation for semantic search

---

## Integration Points for New App

### When Bible Reference Detected:

1. Parse reference using `parseVerseReference()`
2. Look up verse text from Bible data
3. **Save to presenter text file** (your format)
4. **Trigger presenter trigger** (your mechanism)

### When Paraphrased Verse Detected:

1. Receive `ParaphrasedVerse` object with reference and confidence
2. Look up verse text
3. **Save to presenter text file** with confidence score
4. **Trigger presenter trigger**

### When Key Point Extracted:

1. Receive `KeyPoint` object with text and category
2. **Save to presenter text file** with category
3. **Trigger presenter trigger**

### When AI Search Returns Verses:

1. Receive array of verse references
2. Look up verse texts
3. **Save to presenter text file**
4. **Trigger presenter trigger**

---

## Testing

### Test Files Available

- `tests/context-reference-test.js` - Context-aware parsing tests
- `tests/wordtest.js` - Comprehensive parser tests
- `tests/test.js` - Transcription tests

### Running Tests

```bash
node tests/context-reference-test.js
node tests/wordtest.js
```

---

## Known Limitations

1. **Context Reset**: Context persists for entire session - no automatic reset
2. **Language Support**: English only
3. **Edge Cases**: Some natural language patterns not supported:
   - "the last chapter" (requires Bible structure knowledge)
   - Heavy filler words: "Turn to... um... let me see..."
   - Implicit references without explicit verse numbers

---

## Performance Considerations

1. **AI Analysis**:

   - Only processes final transcripts (not interim)
   - Skips chunks < 10 words
   - Can be disabled via flags

2. **Bible Parsing**:

   - Context tracking is lightweight (global variables)
   - Preprocessing is fast (regex operations)

3. **Transcription**:
   - 250ms audio chunks for low latency
   - WebSocket connection for real-time updates

---

## Next Steps for New Developer

1. Review artifacts folder for complete function implementations
2. Set up environment variables (AssemblyAI + Groq API keys)
3. Install dependencies
4. Implement presenter text file format (your choice)
5. Implement presenter trigger mechanism (your choice)
6. Integrate transcription service
7. Integrate Bible parsing functions
8. Integrate AI analysis functions
9. Test with sample transcripts

---

## Support Files

All implementation details and exact functions are provided in the `artifacts/` folder:

- `bible-pacer-functions.ts` - Complete Bible parsing implementation
- `bible-paraphrase-functions.ts` - AI analysis implementation
- `transcription-functions.ts` - Transcription implementation

---

**Last Updated**: Based on codebase review
**Version**: 1.0.0
