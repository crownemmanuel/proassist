# Developer Notes - ProCaster Bible App

Welcome! This folder contains comprehensive documentation and ready-to-use code for re-implementing the core features of the ProCaster Bible app.

---

## 📚 Documentation Files

### 1. **[DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)** ⭐ START HERE
Complete feature documentation covering:
- Live Transcription
- Auto-Detection of Bible References
- Bible Pacer (Advanced Parser)
- Detect Paraphrased Verses
- Extract Key Points
- AI Search for Bible Verses
- Anti-Bible Reference Filtering

**Read this first** to understand all features and how they work.

---

### 2. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**
Quick start guide with:
- Core workflow diagram
- Integration code examples
- File organization suggestions
- Setup checklist

**Use this** when you're ready to start coding.

---

### 3. **[artifacts/](./artifacts/)** 📦 READY-TO-USE CODE
Complete function implementations you can copy directly:

#### **[artifacts/bible-pacer-functions.ts](./artifacts/bible-pacer-functions.ts)**
The core Bible reference parsing system ("Bible Pacer"):
- `parseVerseReference()` - Main parsing function
- Context-aware parsing
- Chapter-only and verse-only support
- Preprocessing for speech-to-text

#### **[artifacts/bible-paraphrase-functions.ts](./artifacts/bible-paraphrase-functions.ts)**
AI-powered transcript analysis:
- `analyzeTranscriptChunk()` - Detect paraphrases and extract key points
- `generateBibleResponse()` - AI Bible search
- Uses Groq AI (Llama 3.3 70B)

#### **[artifacts/transcription-functions.ts](./artifacts/transcription-functions.ts)**
Live transcription service:
- `LiveTranscriptionService` class
- AssemblyAI Realtime API integration
- Audio capture and processing

#### **[artifacts/bible-search-functions.ts](./artifacts/bible-search-functions.ts)**
Full-text Bible search:
- `BibleSearchIndex` class
- Fast keyword-based search
- FlexSearch integration

#### **[artifacts/bible-reference-parser-utils.ts](./artifacts/bible-reference-parser-utils.ts)**
Additional parsing utilities:
- `parseBibleReferences()` - Renderer-side parser
- Handles combined digit formats
- Multiple reference patterns

#### **[artifacts/README.md](./artifacts/README.md)**
Detailed documentation for all artifact files.

---

## 🚀 Quick Start

### Step 1: Read the Documentation
1. Start with **[DEVELOPER_NOTES.md](./DEVELOPER_NOTES.md)** to understand features
2. Review **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** for integration guide

### Step 2: Copy the Code
1. Copy relevant files from `artifacts/` to your project
2. Adapt TypeScript/React patterns to your framework

### Step 3: Set Up Environment
```env
ASSEMBLYAI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

### Step 4: Install Dependencies
```bash
npm install assemblyai recordrtc
npm install bible-passage-reference-parser words-to-numbers
npm install @langchain/groq @langchain/core
npm install flexsearch
```

### Step 5: Implement Presenter Integration
When Bible references are detected:
1. Parse reference using `parseVerseReference()`
2. Look up verse text from Bible data
3. **Save to presenter text file** (your format)
4. **Trigger presenter trigger** (your mechanism)

---

## 📋 Feature Checklist

- [ ] Live Transcription (AssemblyAI)
- [ ] Bible Reference Auto-Detection (Bible Pacer)
- [ ] Paraphrased Verse Detection (AI)
- [ ] Key Point Extraction (AI)
- [ ] AI Bible Search (Groq)
- [ ] Full-Text Bible Search (FlexSearch)
- [ ] Presenter File Integration
- [ ] Presenter Trigger Integration

---

## 🔑 Key Concepts

### Bible Pacer
The sophisticated Bible reference parsing system that handles:
- Natural language references
- Context-aware parsing
- Speech-to-text formatting
- Multiple reference formats

### Context Tracking
The parser remembers the last reference to enable:
- Verse-only references: "verse 17" after "John 3:16"
- Chapter-only references: "Matthew chapter 5" → "Matthew 5:1"

### AI Analysis
Uses Groq AI to:
- Detect when speakers paraphrase Bible verses
- Extract quotable key points from sermons
- Answer natural language Bible questions

---

## 📁 File Structure

```
developer-notes/
├── README.md (this file)
├── DEVELOPER_NOTES.md (main documentation)
├── IMPLEMENTATION_SUMMARY.md (quick start)
└── artifacts/
    ├── README.md
    ├── bible-pacer-functions.ts
    ├── bible-paraphrase-functions.ts
    ├── transcription-functions.ts
    ├── bible-search-functions.ts
    └── bible-reference-parser-utils.ts
```

---

## 💡 Important Notes

1. **No Render Engine**: The new app won't have audience/stage display. When references are detected, save to presenter file and trigger presenter.

2. **Presenter Integration**: You need to implement:
   - Presenter text file format (your choice)
   - Presenter trigger mechanism (your choice)

3. **Bible Data**: You'll need Bible data in JSON format. See `DEVELOPER_NOTES.md` for format details.

4. **Framework Adaptation**: Code is TypeScript/React/Electron. Adapt patterns to your framework.

---

## 🧪 Testing

Test files are available in the main codebase:
- `tests/context-reference-test.js` - Context-aware parsing tests
- `tests/wordtest.js` - Comprehensive parser tests

Run these to verify your implementation matches expected behavior.

---

## 📞 Support

- **Feature Documentation**: See `DEVELOPER_NOTES.md`
- **Function Details**: See `artifacts/README.md`
- **Integration Guide**: See `IMPLEMENTATION_SUMMARY.md`
- **Code Examples**: See individual artifact files

---

## ✅ Next Steps

1. ✅ Read `DEVELOPER_NOTES.md`
2. ✅ Review `IMPLEMENTATION_SUMMARY.md`
3. ✅ Copy artifact files to your project
4. ✅ Set up environment variables
5. ✅ Install dependencies
6. ✅ Implement presenter integration
7. ✅ Test with sample transcripts

---

**Good luck with your implementation!**

*Last Updated: Based on codebase review*
*Version: 1.0.0*
