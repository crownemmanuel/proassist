# Artifacts - Function Implementations

This folder contains complete, ready-to-use implementations of all core functions from the ProCaster Bible app. These can be directly copied and adapted for your new application.

## Files

### 1. `bible-pacer-functions.ts`
**Complete Bible reference parsing system**

Contains all functions for parsing Bible references from natural language:
- `parseVerseReference()` - Main parsing function
- `preprocessBibleReference()` - Text normalization
- `isVerseOnlyReference()` - Detect verse-only patterns
- `isChapterOnlyReference()` - Detect chapter-only patterns
- Context tracking system
- Error recovery mechanisms

**Key Features:**
- Context-aware parsing (remembers last reference)
- Supports chapter-only references
- Supports verse-only references
- Handles speech-to-text formatting (periods, written numbers)
- Multiple fallback strategies

**Dependencies:**
- `bible-passage-reference-parser`
- `words-to-numbers`

---

### 2. `bible-paraphrase-functions.ts`
**AI-powered transcript analysis**

Contains functions for:
- Detecting paraphrased Bible verses using AI
- Extracting key quotable points from sermons
- AI-powered Bible verse search

**Key Functions:**
- `analyzeTranscriptChunk()` - Main analysis function
- `generateBibleResponse()` - AI Bible search

**Features:**
- Paraphrase detection with confidence scores
- Key point extraction with categories
- Natural language Bible queries

**Dependencies:**
- `@langchain/groq`
- `@langchain/core`
- Groq API key required

**Environment Variable:**
```env
GROQ_API_KEY=your_groq_api_key
```

---

### 3. `transcription-functions.ts`
**Live transcription service**

Complete implementation of AssemblyAI Realtime transcription:
- `LiveTranscriptionService` class - Main transcription service
- `initializeTranscriptionIpc()` - Backend token generation

**Features:**
- Real-time speech-to-text
- Interim and final transcript handling
- Microphone device selection
- Error handling and cleanup

**Dependencies:**
- `assemblyai` (streaming)
- `recordrtc`

**Environment Variable:**
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

---

### 4. `bible-search-functions.ts`
**Full-text Bible search**

Fast keyword-based search across Bible verses:
- `BibleSearchIndex` class - Search index manager
- `createSearchIndex()` - Build search index
- `searchBible()` - Search function

**Features:**
- Fast full-text search
- Token-based indexing
- Returns verse references and text

**Dependencies:**
- `flexsearch`

**Alternative:** For semantic search using embeddings, see `bibleparaphraseer/verse-detector/` in the main codebase.

---

## Integration Guide

### Step 1: Install Dependencies

```bash
npm install bible-passage-reference-parser words-to-numbers
npm install @langchain/groq @langchain/core
npm install assemblyai recordrtc
npm install flexsearch
```

### Step 2: Set Up Environment Variables

Create a `.env` file:
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
GROQ_API_KEY=your_groq_api_key
```

### Step 3: Copy Functions

Copy the relevant function files to your project and adapt as needed for your framework.

### Step 4: Load Bible Data

You'll need Bible data in JSON format. The app expects:
```json
[
  {
    "name": "Genesis",
    "abbrev": "Gen",
    "chapters": [
      ["In the beginning...", "And the earth was...", ...],
      ["Thus the heavens...", ...],
      ...
    ]
  },
  ...
]
```

### Step 5: Implement Presenter Integration

When Bible references are detected:
1. Parse reference using `parseVerseReference()`
2. Look up verse text from Bible data
3. **Save to presenter text file** (your format)
4. **Trigger presenter trigger** (your mechanism)

---

## Usage Examples

### Parse Bible Reference
```typescript
import { parseVerseReference } from './bible-pacer-functions';

const result = parseVerseReference("John 3:16");
// Returns: [{ book: "John", chapter: 3, startVerse: 16, ... }]
```

### Analyze Transcript
```typescript
import { analyzeTranscriptChunk } from './bible-paraphrase-functions';

const result = await analyzeTranscriptChunk(
  "God so loved the world that he gave his son",
  true,  // detect paraphrases
  true   // extract key points
);
```

### Start Transcription
```typescript
import { LiveTranscriptionService } from './transcription-functions';

const transcription = new LiveTranscriptionService({
  onFinalTranscript: (text) => {
    // Process transcript for Bible references
  }
});

await transcription.startTranscription(token);
```

### Search Bible
```typescript
import { BibleSearchIndex } from './bible-search-functions';

const searchIndex = new BibleSearchIndex();
searchIndex.createSearchIndex(bibleData);
const results = searchIndex.searchBible("love");
```

---

## Notes

- All functions are TypeScript but can be adapted to JavaScript
- Some functions use React/Electron patterns - adapt for your framework
- Error handling is included but you may want to enhance it
- Logging is verbose - adjust for production use
- Context tracking uses global variables - consider refactoring for your architecture

---

## Testing

Test files are available in the main codebase:
- `tests/context-reference-test.js` - Context-aware parsing tests
- `tests/wordtest.js` - Comprehensive parser tests

Run tests to verify your implementation matches expected behavior.
