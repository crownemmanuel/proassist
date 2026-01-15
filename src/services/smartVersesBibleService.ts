/**
 * SmartVerses Bible Service
 * 
 * Enhanced Bible reference parsing service with context-aware parsing,
 * speech-to-text preprocessing, and verse lookup capabilities.
 * 
 * Based on the "Bible Pacer" system from the original SmartVerses app.
 */

import { bcv_parser } from "bible-passage-reference-parser/esm/bcv_parser";
import * as en from "bible-passage-reference-parser/esm/lang/en";
import { 
  ParsedBibleReference, 
  BibleParseContext, 
  DetectedBibleReference 
} from "../types/smartVerses";
import { loadVerses } from "./bibleService";

// =============================================================================
// GLOBAL STATE - Context Tracking
// =============================================================================

/**
 * Enhanced context tracking for chapter and verse-only references
 * This maintains the last successfully parsed reference for context-aware parsing
 */
let lastParsedContext: BibleParseContext = {
  book: null,
  chapter: null,
  verse: null,
  fullReference: null,
};

// Legacy context variable (for backward compatibility with bcv_parser)
let legacyContext: string | null = null;

// Singleton parser instance
let bcvParser: bcv_parser | null = null;

// Book name mapping from parser output to standard names
const BOOK_NAME_MAPPING: Record<string, string> = {
  Gen: "Genesis",
  Exod: "Exodus",
  Lev: "Leviticus",
  Num: "Numbers",
  Deut: "Deuteronomy",
  Josh: "Joshua",
  Judg: "Judges",
  Ruth: "Ruth",
  "1Sam": "1 Samuel",
  "2Sam": "2 Samuel",
  "1Kgs": "1 Kings",
  "2Kgs": "2 Kings",
  "1Chr": "1 Chronicles",
  "2Chr": "2 Chronicles",
  Ezra: "Ezra",
  Neh: "Nehemiah",
  Esth: "Esther",
  Job: "Job",
  Ps: "Psalms",
  Prov: "Proverbs",
  Eccl: "Ecclesiastes",
  Song: "Song of Solomon",
  Isa: "Isaiah",
  Jer: "Jeremiah",
  Lam: "Lamentations",
  Ezek: "Ezekiel",
  Dan: "Daniel",
  Hos: "Hosea",
  Joel: "Joel",
  Amos: "Amos",
  Obad: "Obadiah",
  Jonah: "Jonah",
  Mic: "Micah",
  Nah: "Nahum",
  Hab: "Habakkuk",
  Zeph: "Zephaniah",
  Hag: "Haggai",
  Zech: "Zechariah",
  Mal: "Malachi",
  Matt: "Matthew",
  Mark: "Mark",
  Luke: "Luke",
  John: "John",
  Acts: "Acts",
  Rom: "Romans",
  "1Cor": "1 Corinthians",
  "2Cor": "2 Corinthians",
  Gal: "Galatians",
  Eph: "Ephesians",
  Phil: "Philippians",
  Col: "Colossians",
  "1Thess": "1 Thessalonians",
  "2Thess": "2 Thessalonians",
  "1Tim": "1 Timothy",
  "2Tim": "2 Timothy",
  Titus: "Titus",
  Phlm: "Philemon",
  Heb: "Hebrews",
  Jas: "James",
  "1Pet": "1 Peter",
  "2Pet": "2 Peter",
  "1John": "1 John",
  "2John": "2 John",
  "3John": "3 John",
  Jude: "Jude",
  Rev: "Revelation",
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Get or initialize the BCV parser
 */
function getParser(): bcv_parser {
  if (!bcvParser) {
    bcvParser = new bcv_parser(en);
    bcvParser.set_options({
      osis_compaction_strategy: "bcv",
      consecutive_combination_strategy: "combine",
    });
  }
  return bcvParser;
}

/**
 * Reset the parsing context
 */
export function resetParseContext(): void {
  lastParsedContext = {
    book: null,
    chapter: null,
    verse: null,
    fullReference: null,
  };
  legacyContext = null;
}

/**
 * Get the current parsing context
 */
export function getParseContext(): BibleParseContext {
  return { ...lastParsedContext };
}

// =============================================================================
// PREPROCESSING FUNCTIONS
// =============================================================================

/**
 * Simple number word to digit conversion
 * Handles basic written numbers commonly used in speech
 */
function wordsToNumbers(text: string): string {
  const numberWords: Record<string, string> = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
    'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
    'eighteen': '18', 'nineteen': '19', 'twenty': '20',
    'thirty': '30', 'forty': '40', 'fifty': '50',
    'first': '1', 'second': '2', 'third': '3',
  };

  let result = text.toLowerCase();
  
  // Handle compound numbers like "twenty one" -> "21"
  const compoundPattern = /(twenty|thirty|forty|fifty)\s+(one|two|three|four|five|six|seven|eight|nine)/gi;
  result = result.replace(compoundPattern, (_, tens, ones) => {
    const tensVal = parseInt(numberWords[tens.toLowerCase()] || '0');
    const onesVal = parseInt(numberWords[ones.toLowerCase()] || '0');
    return String(tensVal + onesVal);
  });

  // Handle simple number words
  for (const [word, digit] of Object.entries(numberWords)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(pattern, digit);
  }

  return result;
}

/**
 * Preprocessor function to normalize Bible references before parsing
 * Handles period-separated references from speech-to-text
 */
function preprocessBibleReference(reference: string): string {
  // Step 1: Replace periods followed by spaces (or end of string) with just spaces
  // This handles cases like "Luke. Three. Three." -> "Luke Three Three"
  let normalized = reference.replace(/\.\s*/g, ' ');

  // Step 1b: Remove commas that speech-to-text often inserts between words
  // Example: "Romans, three, five" -> "Romans three five"
  // IMPORTANT: We only remove commas that follow letters, so verse lists like "John 3:16, 17"
  // (comma after a digit) remain intact.
  normalized = normalized.replace(/([A-Za-z])\s*,\s*(?=[A-Za-z0-9])/g, '$1 ');

  // Step 2: Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Normalize common speech-to-text pattern: "Book 3, 5" -> "Book 3:5"
 *
 * AssemblyAI (and similar STT) frequently produces "Romans three, five" or "Romans 3, 5"
 * when the speaker means Romans 3:5. The BCV parser interprets "3, 5" as chapters 3 and 5,
 * so we rewrite this to a chapter:verse form before parsing.
 */
function normalizeCommaSeparatedChapterVerse(text: string): string {
  return text.replace(
    /\b((?:[1-3]\s*)?[A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*)*)\s+(\d{1,3})\s*,\s*(\d{1,3})(?=[^\d]|$)/gi,
    (_match, book, chapter, verse) => `${book} ${chapter}:${verse}`
  );
}

/**
 * Normalize speech pattern: "Book 3 verse 5" or "Book chapter 3 verse 5" -> "Book 3:5"
 * This is common in live speech (e.g., "Psalm 66, verse three").
 *
 * Only used in aggressive speech normalization (transcription), not search box.
 */
function normalizeBookChapterVersePhrase(text: string): string {
  const bookPrefix = "(?:the\\s+)?(?:book\\s+of\\s+)?";
  const bookPattern = "((?:[1-3]\\s*)?[A-Za-z][A-Za-z0-9]*(?:\\s+[A-Za-z][A-Za-z0-9]*)*)";
  const regex = new RegExp(
    `\\b${bookPrefix}${bookPattern}\\s+(?:chapter\\s+)?(\\d{1,3})\\s+(?:verse|verses|v|vs)\\s+(\\d{1,3})(?=[^\\d]|$)`,
    "gi"
  );
  return text.replace(regex, (_match, book, chapter, verse) => `${book} ${chapter}:${verse}`);
}


/**
 * Resolve a book name to the canonical form used in the verse data.
 */
function resolveBookName(bookText: string): string {
  // NOTE: `bcv_parser` does not return OSIS for a bare book name (e.g., "john"),
  // so we probe with a minimal reference ("Book 1:1") to resolve the OSIS book.
  const normalizedBookText = bookText
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^([1-3])\s*(?=[A-Za-z])/, "$1 "); // "1john" -> "1 john"

  const parser = getParser();
  parser.parse(`${normalizedBookText} 1:1`);
  const osis = parser.osis?.() as string | undefined;
  if (osis && osis.length > 0) {
    const first = osis.split(",")[0];
    const osisBook = first.split(".")[0];
    return mapBookName(osisBook);
  }

  // Fallback: return normalized input (may be lowercased); downstream parsing is case-insensitive.
  return normalizedBookText;
}

/**
 * Try to interpret combined chapter+verse digits like "John316" as "John 3:16".
 * Only applies when there is exactly one valid match in the verse data.
 */
async function normalizeCombinedChapterVerseInput(text: string): Promise<string> {
  const BOOKS_REGEX =
    "(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|" +
    "Joshua|Judges|Ruth|1\\s*Samuel|2\\s*Samuel|1\\s*Kings|2\\s*Kings|" +
    "1\\s*Chronicles|2\\s*Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|" +
    "Proverbs|Ecclesiastes|Song\\s+of\\s+Solomon|Isaiah|Jeremiah|Lamentations|" +
    "Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|" +
    "Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|" +
    "1\\s*Corinthians|2\\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|" +
    "1\\s*Thessalonians|2\\s*Thessalonians|1\\s*Timothy|2\\s*Timothy|Titus|Philemon|" +
    "Hebrews|James|1\\s*Peter|2\\s*Peter|1\\s*John|2\\s*John|3\\s*John|Jude|Revelation)";

  const combinedRegex = new RegExp(
    `(?:\\b(?:the\\s+)?(?:book\\s+of\\s+))?(?<book>${BOOKS_REGEX})\\s*(?<combined>\\d{3,5})\\b`,
    "gi"
  );

  const verses = await loadVerses();
  let result = text;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(result)) !== null) {
    const groups = match.groups as { book?: string; combined?: string } | undefined;
    const bookText = groups?.book;
    const combined = groups?.combined;
    if (!bookText || !combined) continue;

    const bookName = resolveBookName(bookText);
    const candidates: Array<{ chapter: number; verse: number }> = [];

    // Try chapter lengths of 1 and 2 digits (most realistic)
    for (const chapterLen of [1, 2]) {
      if (combined.length <= chapterLen) continue;
      const chapter = parseInt(combined.slice(0, chapterLen), 10);
      const verse = parseInt(combined.slice(chapterLen), 10);
      if (!Number.isFinite(chapter) || !Number.isFinite(verse)) continue;
      if (chapter <= 0 || verse <= 0) continue;
      candidates.push({ chapter, verse });
    }

    const valid = candidates.filter((c) => {
      const key = `${bookName} ${c.chapter}:${c.verse}`;
      return key in verses;
    });

    if (valid.length === 1) {
      const { chapter, verse } = valid[0];
      const replacement = `${bookName} ${chapter}:${verse}`;
      result =
        result.slice(0, match.index) +
        replacement +
        result.slice(match.index + match[0].length);

      // Reset regex index after replacement
      combinedRegex.lastIndex = match.index + replacement.length;
    }
  }

  return result;
}

// =============================================================================
// PATTERN DETECTION FUNCTIONS
// =============================================================================

/**
 * Check if reference is verse-only (e.g., "verse 7", "from verse 18", "in verse 5")
 */
function isVerseOnlyReference(text: string): number | null {
  const normalized = text.trim();

  // Look for "verse" or "v" followed by a number anywhere in the text
  const flexiblePatterns = [
    /(?:verse|vs?\.?)\s+(\d+)/i,
  ];

  for (const pattern of flexiblePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const verseNum = parseInt(match[1], 10);
      if (!isNaN(verseNum) && verseNum > 0) {
        return verseNum;
      }
    }
  }

  return null;
}

/**
 * Check if reference is chapter-only (e.g., "Matthew chapter 5", "chapter 3 of John")
 */
function isChapterOnlyReference(text: string): { book: string; chapter: number } | null {
  const chapterOnlyPatterns = [
    // "Matthew chapter 5", "Luke chapter three"
    /^(?:the\s+book\s+of\s+)?([A-Za-z0-9\s]+?)\s+chapter\s+(\d+|[a-z]+)$/i,
    // "chapter 5 of Matthew"
    /^chapter\s+(\d+|[a-z]+)\s+of\s+([A-Za-z0-9\s]+)$/i,
  ];

  const normalized = text.trim();

  for (const pattern of chapterOnlyPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let book, chapterStr;
      if (pattern.source.startsWith('^chapter')) {
        chapterStr = match[1];
        book = match[2];
      } else {
        book = match[1];
        chapterStr = match[2];
      }

      const chapter = parseInt(chapterStr, 10);
      if (!isNaN(chapter)) {
        return { book: book.trim(), chapter };
      }
    }
  }
  return null;
}

/**
 * Check for navigation commands that should be filtered out
 */
function isNavigationCommand(text: string): 'next' | 'previous' | null {
  const normalized = text.toLowerCase().trim();
  
  const nextPatterns = [
    /\bnext\s+(?:verse|scripture|one)\b/,
    /\bgo\s+(?:to\s+)?next\b/,
    /\bshow\s+next\b/,
  ];
  
  const prevPatterns = [
    /\b(?:previous|last)\s+(?:verse|scripture|one)\b/,
    /\bgo\s+back\b/,
  ];
  
  for (const pattern of nextPatterns) {
    if (pattern.test(normalized)) return 'next';
  }
  
  for (const pattern of prevPatterns) {
    if (pattern.test(normalized)) return 'previous';
  }
  
  return null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract chapter and verse numbers from text using regex
 */
function extractChapterAndVerse(text: string): { chapter: number | null; verse: number | null } {
  const result = {
    chapter: null as number | null,
    verse: null as number | null,
  };

  const chapterPattern = /(?:chapter|ch\.?)\s*(\d+)/i;
  const versePattern = /(?:verse|v\.?)\s*(\d+)/i;

  const chapterMatch = text.match(chapterPattern);
  if (chapterMatch) {
    result.chapter = parseInt(chapterMatch[1]);
  }

  const verseMatch = text.match(versePattern);
  if (verseMatch) {
    result.verse = parseInt(verseMatch[1]);
  }

  return result;
}

/**
 * Map parser book name to full book name
 */
function mapBookName(parserBook: string): string {
  return BOOK_NAME_MAPPING[parserBook] || parserBook;
}

/**
 * Create display reference string
 */
function createDisplayRef(book: string, chapter: number, startVerse: number, endVerse?: number): string {
  const fullBook = mapBookName(book);
  if (endVerse && endVerse !== startVerse) {
    return `${fullBook} ${chapter}:${startVerse}-${endVerse}`;
  }
  return `${fullBook} ${chapter}:${startVerse}`;
}

// =============================================================================
// MAIN PARSING FUNCTION
// =============================================================================

/**
 * Main function to parse a Bible verse reference
 * This is the core "Bible Pacer" function that handles all reference formats
 */
export function parseVerseReference(reference: string): ParsedBibleReference[] | null {
  // Check for navigation commands first
  if (isNavigationCommand(reference)) {
    return null;
  }

  let passages: ParsedBibleReference[] | null = null;

  try {
    // Step 1: Preprocess the reference
    const preprocessed = preprocessBibleReference(reference);

    // Step 2: Convert written numbers to numeric values
    const textToProcess = normalizeCommaSeparatedChapterVerse(wordsToNumbers(preprocessed));

    // Check for "chapter X verse Y" without book name (use context)
    const chapterVersePattern = /chapter\s+(\d+)[,\s]+verse\s+(\d+)/i;
    const chapterVerseMatch = textToProcess.match(chapterVersePattern);
    if (chapterVerseMatch && lastParsedContext.book) {
      const chapter = parseInt(chapterVerseMatch[1], 10);
      const verse = parseInt(chapterVerseMatch[2], 10);

      const mappedBook = mapBookName(lastParsedContext.book);
      passages = [
        {
          book: mappedBook,
          fullBookName: lastParsedContext.book,
          chapter: chapter,
          startVerse: verse,
          endVerse: verse,
          translation: 'default',
          displayRef: createDisplayRef(lastParsedContext.book, chapter, verse),
        },
      ];

      // Update context
      lastParsedContext.chapter = chapter;
      lastParsedContext.verse = verse;
      lastParsedContext.fullReference = `${mappedBook} ${chapter}:${verse}`;

      return passages;
    }

    // Check for verse-only reference (e.g., "verse 7", "from verse 18")
    const verseOnly = isVerseOnlyReference(textToProcess);
    if (verseOnly !== null && lastParsedContext.book && lastParsedContext.chapter) {
      const mappedBook = mapBookName(lastParsedContext.book);
      passages = [
        {
          book: mappedBook,
          fullBookName: lastParsedContext.book,
          chapter: lastParsedContext.chapter,
          startVerse: verseOnly,
          endVerse: verseOnly,
          translation: 'default',
          displayRef: createDisplayRef(lastParsedContext.book, lastParsedContext.chapter, verseOnly),
        },
      ];

      // Update context
      lastParsedContext.verse = verseOnly;
      lastParsedContext.fullReference = `${mappedBook} ${lastParsedContext.chapter}:${verseOnly}`;

      return passages;
    }

    // Check for chapter-only reference (e.g., "Matthew chapter 5")
    const chapterOnly = isChapterOnlyReference(textToProcess);
    if (chapterOnly !== null) {
      const parser = getParser();
      const bookResult = parser.parse(chapterOnly.book);
      let fullBookName = chapterOnly.book;

      const osisResults = bookResult.osis_and_indices();
      if (osisResults && osisResults.length > 0 && osisResults[0].osis) {
        const osisParts = osisResults[0].osis.split('.');
        if (osisParts.length > 0) {
          fullBookName = osisParts[0];
        }
      }

      const mappedBook = mapBookName(fullBookName);
      passages = [
        {
          book: mappedBook,
          fullBookName: fullBookName,
          chapter: chapterOnly.chapter,
          startVerse: 1,
          endVerse: 1,
          translation: 'default',
          displayRef: createDisplayRef(fullBookName, chapterOnly.chapter, 1),
        },
      ];

      // Update context
      lastParsedContext.book = fullBookName;
      lastParsedContext.chapter = chapterOnly.chapter;
      lastParsedContext.verse = 1;
      lastParsedContext.fullReference = `${mappedBook} ${chapterOnly.chapter}:1`;

      return passages;
    }

    // Standard parsing using bcv_parser
    const parser = getParser();
    parser.parse(textToProcess);
    passages = [];

    // Use `parser.entities[].passages[]` to avoid fragile string parsing of OSIS ranges.
    // This correctly handles:
    // - chapter-only inputs (e.g., "Romans 3" => start v=1, end v=31)
    // - verse ranges (e.g., "John 3:16-18")
    // - multiple references (e.g., "Romans 3:3, 5")
    const entities = ((parser as unknown) as any).entities as Array<any> | undefined;
    for (const entity of entities || []) {
      const entityPassages = (entity as any).passages as Array<any> | undefined;
      if (!entityPassages) continue;

      for (const p of entityPassages) {
        if (!p?.valid?.valid) continue;

        const start = p.start;
        const end = p.end || p.start;

        if (!start?.b || !start?.c) continue;

        const book = mapBookName(start.b);
        const chapter = start.c;
        const startVerse = start.v || 1;
        const endVerse = end.v || startVerse;

        passages.push({
          book,
          fullBookName: start.b,
          chapter,
          startVerse,
          endVerse,
          translation: 'default',
          displayRef: createDisplayRef(start.b, chapter, startVerse, endVerse !== startVerse ? endVerse : undefined),
        });
      }
    }

  } catch (error) {
    console.error('Error parsing verse reference:', error);
  }

  // If no passages found and we have a stored context, try parsing with context
  if ((!passages || passages.length === 0) && lastParsedContext.fullReference) {
    try {
      const parser = getParser();
      const contextResult = parser.parse_with_context(reference, lastParsedContext.fullReference);
      const osisRef = contextResult.osis();
      if (osisRef) {
        passages = parseVerseReference(osisRef);
      }
    } catch (error) {
      console.error('Error parsing with context:', error);
    }
  }

  // Also try with the old context variable as a final fallback
  if ((!passages || passages.length === 0) && legacyContext && legacyContext !== reference) {
    try {
      const parser = getParser();
      const contextResult = parser.parse_with_context(reference, legacyContext);
      const osisRef = contextResult.osis();
      if (osisRef) {
        passages = parseVerseReference(osisRef);
      }
    } catch (error) {
      console.error('Error with legacy context:', error);
    }
  }

  // If still no passages and context exists, try regex extraction
  if ((!passages || passages.length === 0) && legacyContext) {
    const extracted = extractChapterAndVerse(reference);
    if (extracted.chapter || extracted.verse) {
      const contextParts = legacyContext.match(/^(.+?)\s+(\d+):(\d+)$/);
      if (contextParts) {
        const [, book, contextChapter, contextVerse] = contextParts;
        const chapter = extracted.chapter || parseInt(contextChapter);
        const verse = extracted.verse || parseInt(contextVerse);

        passages = [
          {
            book: book,
            fullBookName: book,
            chapter,
            startVerse: verse,
            endVerse: verse,
            translation: 'default',
            displayRef: createDisplayRef(book, chapter, verse),
          },
        ];
      }
    }
  }

  // If we successfully parsed a reference, update the context variables
  if (passages && passages.length > 0) {
    legacyContext = reference;

    const firstPassage = passages[0];
    lastParsedContext.book = firstPassage.fullBookName || firstPassage.book;
    lastParsedContext.chapter = firstPassage.chapter;
    lastParsedContext.verse = firstPassage.startVerse;
    lastParsedContext.fullReference = `${firstPassage.book} ${firstPassage.chapter}:${firstPassage.startVerse}`;
  }

  return passages && passages.length > 0 ? passages : null;
}

// =============================================================================
// VERSE LOOKUP FUNCTIONS
// =============================================================================

/**
 * Look up verse text for a parsed reference
 */
export async function lookupVerse(reference: ParsedBibleReference): Promise<string | null> {
  try {
    const verses = await loadVerses();
    const key = `${reference.book} ${reference.chapter}:${reference.startVerse}`;
    const text = verses[key];
    
    if (!text) {
      return null;
    }

    // Clean up the verse text
    return text
      .replace(/^#\s*/, "") // Remove leading #
      .replace(/\[([^\]]+)\]/g, "$1"); // Remove brackets around italic words
  } catch (error) {
    console.error('Error looking up verse:', error);
    return null;
  }
}

/**
 * Look up multiple verses for a reference range
 */
export async function lookupVerses(reference: ParsedBibleReference): Promise<Array<{
  verse: number;
  text: string;
  displayRef: string;
}>> {
  const results: Array<{ verse: number; text: string; displayRef: string }> = [];
  
  try {
    const verses = await loadVerses();
    
    for (let v = reference.startVerse; v <= reference.endVerse; v++) {
      const key = `${reference.book} ${reference.chapter}:${v}`;
      let text = verses[key];
      
      if (text) {
        // Clean up the verse text
        text = text
          .replace(/^#\s*/, "")
          .replace(/\[([^\]]+)\]/g, "$1");
        
        results.push({
          verse: v,
          text,
          displayRef: `${reference.book} ${reference.chapter}:${v}`,
        });
      }
    }
  } catch (error) {
    console.error('Error looking up verses:', error);
  }
  
  return results;
}

// =============================================================================
// HIGH-LEVEL DETECTION FUNCTION
// =============================================================================

/**
 * Detect Bible references in text and return fully resolved references with verse text
 */
export async function detectAndLookupReferences(
  text: string,
  options?: { aggressiveSpeechNormalization?: boolean }
): Promise<DetectedBibleReference[]> {
  const results: DetectedBibleReference[] = [];

  // Normalize common speech/typo patterns before parsing
  const preprocessed = preprocessBibleReference(text);
  const numericText = wordsToNumbers(preprocessed);
  const normalizedText = await normalizeCombinedChapterVerseInput(
    normalizeCommaSeparatedChapterVerse(
      options?.aggressiveSpeechNormalization
        ? normalizeBookChapterVersePhrase(numericText)
        : numericText
    )
  );

  const parsed = parseVerseReference(normalizedText);
  if (!parsed || parsed.length === 0) {
    return results;
  }

  for (const ref of parsed) {
    const verseData = await lookupVerses(ref);
    
    for (const verse of verseData) {
      results.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        reference: verse.displayRef,
        displayRef: verse.displayRef,
        verseText: verse.text,
        source: 'direct',
        transcriptText: text,
        timestamp: Date.now(),
        // Include components for navigation
        book: ref.book,
        chapter: ref.chapter,
        verse: verse.verse,
      });
    }
  }

  return results;
}

// =============================================================================
// VERSE NAVIGATION FUNCTIONS
// =============================================================================

/**
 * Check if a verse exists in the Bible data
 */
export async function verseExists(book: string, chapter: number, verse: number): Promise<boolean> {
  try {
    const verses = await loadVerses();
    const key = `${book} ${chapter}:${verse}`;
    return key in verses;
  } catch {
    return false;
  }
}

/**
 * Get the previous verse reference if it exists
 * Handles chapter boundaries (e.g., John 3:1 → John 2:25)
 */
export async function getPreviousVerse(
  book: string,
  chapter: number,
  verse: number
): Promise<{ book: string; chapter: number; verse: number; displayRef: string } | null> {
  try {
    const verses = await loadVerses();
    
    // Try previous verse in same chapter
    if (verse > 1) {
      const prevKey = `${book} ${chapter}:${verse - 1}`;
      if (prevKey in verses) {
        return {
          book,
          chapter,
          verse: verse - 1,
          displayRef: prevKey,
        };
      }
    }
    
    // Try last verse of previous chapter
    if (chapter > 1) {
      // Find the last verse of the previous chapter by checking verses 1-200
      for (let v = 200; v >= 1; v--) {
        const prevChapterKey = `${book} ${chapter - 1}:${v}`;
        if (prevChapterKey in verses) {
          return {
            book,
            chapter: chapter - 1,
            verse: v,
            displayRef: prevChapterKey,
          };
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the next verse reference if it exists
 * Handles chapter boundaries (e.g., John 3:36 → John 4:1)
 */
export async function getNextVerse(
  book: string,
  chapter: number,
  verse: number
): Promise<{ book: string; chapter: number; verse: number; displayRef: string } | null> {
  try {
    const verses = await loadVerses();
    
    // Try next verse in same chapter
    const nextKey = `${book} ${chapter}:${verse + 1}`;
    if (nextKey in verses) {
      return {
        book,
        chapter,
        verse: verse + 1,
        displayRef: nextKey,
      };
    }
    
    // Try first verse of next chapter
    const nextChapterKey = `${book} ${chapter + 1}:1`;
    if (nextChapterKey in verses) {
      return {
        book,
        chapter: chapter + 1,
        verse: 1,
        displayRef: nextChapterKey,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get navigation info for a verse (previous and next availability)
 */
export async function getVerseNavigation(
  book: string,
  chapter: number,
  verse: number
): Promise<{
  hasPrevious: boolean;
  hasNext: boolean;
  previous: { book: string; chapter: number; verse: number; displayRef: string } | null;
  next: { book: string; chapter: number; verse: number; displayRef: string } | null;
}> {
  const [previous, next] = await Promise.all([
    getPreviousVerse(book, chapter, verse),
    getNextVerse(book, chapter, verse),
  ]);

  return {
    hasPrevious: previous !== null,
    hasNext: next !== null,
    previous,
    next,
  };
}

/**
 * Load a verse by its components and return full reference data
 */
export async function loadVerseByComponents(
  book: string,
  chapter: number,
  verse: number
): Promise<{
  reference: string;
  displayRef: string;
  verseText: string;
  book: string;
  chapter: number;
  verse: number;
} | null> {
  try {
    const verses = await loadVerses();
    const key = `${book} ${chapter}:${verse}`;
    const text = verses[key];
    
    if (!text) return null;
    
    // Clean up the verse text
    const cleanedText = text
      .replace(/^#\s*/, "")
      .replace(/\[([^\]]+)\]/g, "$1");
    
    return {
      reference: key,
      displayRef: key,
      verseText: cleanedText,
      book,
      chapter,
      verse,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Note: verseExists, getPreviousVerse, getNextVerse, getVerseNavigation, and 
// loadVerseByComponents are already exported in their function declarations above.

export {
  preprocessBibleReference,
  wordsToNumbers,
  isVerseOnlyReference,
  isChapterOnlyReference,
  isNavigationCommand,
  mapBookName,
};
