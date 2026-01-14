/**
 * BIBLE PACER FUNCTIONS
 * 
 * Complete implementation of the Bible reference parsing system.
 * This is the core "Bible Pacer" functionality that handles natural language,
 * context-aware Bible reference parsing.
 * 
 * These functions can be directly copied and adapted for your new app.
 */

import wordsToNumbers from 'words-to-numbers';
const bcv_parser = require('bible-passage-reference-parser/js/en_bcv_parser').bcv_parser;

// ============================================================================
// GLOBAL STATE - Context Tracking
// ============================================================================

/**
 * Enhanced context tracking for chapter and verse-only references
 * This maintains the last successfully parsed reference for context-aware parsing
 */
let lastParsedContext = {
  book: null as string | null,
  chapter: null as number | null,
  verse: null as number | null,
  fullReference: null as string | null,
};

// Legacy context variable (for backward compatibility)
let context: string | null = null;

// Book mapping for standardizing book names
// Load this from your bibleBookMapping.json file
let bookMapping: Record<string, string> = {};

// Initialize the Bible passage reference parser
const bcv = new bcv_parser();

// ============================================================================
// PREPROCESSING FUNCTIONS
// ============================================================================

/**
 * Preprocessor function to normalize Bible references before parsing
 * Handles period-separated references from speech-to-text
 * 
 * @param reference - Raw Bible reference string
 * @returns Normalized reference string
 * 
 * Example: "Luke. Three. Three." → "Luke Three Three"
 */
function preprocessBibleReference(reference: string): string {
  // Step 1: Replace periods followed by spaces (or end of string) with just spaces
  // This handles cases like "Luke. Three. Three." -> "Luke Three Three"
  let normalized = reference.replace(/\.\s*/g, ' ');

  // Step 2: Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// ============================================================================
// PATTERN DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if reference is verse-only (e.g., "verse 7", "from verse 18", "in verse 5")
 * More flexible: looks for "verse [number]" anywhere in the text
 * 
 * @param text - Text to check
 * @returns Verse number if verse-only pattern found, null otherwise
 */
function isVerseOnlyReference(text: string): number | null {
  const normalized = text.trim();

  // Look for "verse" or "v" followed by a number anywhere in the text
  // This allows patterns like "If we jump to verse 10" to work
  const flexiblePatterns = [
    /(?:verse|vs?\.?)\s+(\d+)/i, // Matches "verse 10", "v 10", "vs 10" anywhere
  ];

  for (const pattern of flexiblePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const verseNum = parseInt(match[1], 10);
      // Only return if we found a valid verse number
      if (!isNaN(verseNum) && verseNum > 0) {
        return verseNum;
      }
    }
  }

  return null;
}

/**
 * Check if reference is chapter-only (e.g., "Matthew chapter 5", "chapter 3 of John")
 * 
 * @param text - Text to check
 * @returns Object with book and chapter if chapter-only pattern found, null otherwise
 */
function isChapterOnlyReference(
  text: string,
): { book: string; chapter: number } | null {
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
      // Check if this is the "chapter X of Book" format
      if (pattern.source.startsWith('^chapter')) {
        // "chapter X of Book" format
        chapterStr = match[1];
        book = match[2];
      } else {
        // "Book chapter X" format
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract chapter and verse numbers from text using regex
 * Used as fallback when standard parsing fails
 * 
 * @param text - Text to extract from
 * @returns Object with chapter and verse numbers (may be null)
 */
function extractChapterAndVerse(text: string): { chapter: number | null; verse: number | null } {
  const result = {
    chapter: null as number | null,
    verse: null as number | null,
  };

  // Regex patterns to extract chapter and verse
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
 * Construct a full Bible reference from context and extracted chapter/verse
 * Used when parsing fails but we have context
 * 
 * @param context - Previous Bible reference (e.g., "John 3:16")
 * @param extracted - Extracted chapter and verse numbers
 * @returns Constructed reference string or null
 */
function constructReferenceFromExtracted(
  context: string,
  extracted: { chapter: number | null; verse: number | null }
): string | null {
  if (!context || (!extracted.chapter && !extracted.verse)) return null;

  try {
    // Expecting context to be in the format "BookName Chapter:Verse"
    const contextParts = context.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!contextParts) return null;

    const [, book, contextChapter, contextVerse] = contextParts;
    // Use extracted values if available, otherwise fallback to the context values
    const chapter = extracted.chapter || parseInt(contextChapter);
    const verse = extracted.verse || parseInt(contextVerse);

    return `${book} ${chapter}:${verse}`;
  } catch (error) {
    console.error('Error constructing reference:', error);
    return null;
  }
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

/**
 * Main function to parse a Bible verse reference
 * This is the core "Bible Pacer" function that handles all reference formats
 * 
 * @param reference - Bible reference string (can be natural language)
 * @returns Array of passage objects or null if parsing fails
 * 
 * Passage object format:
 * {
 *   book: string,              // Mapped book name (e.g., "John")
 *   fullBookName: string,      // Full book name for context
 *   chapter: number,           // Chapter number
 *   startVerse: number,        // Starting verse number
 *   endVerse: number,         // Ending verse number (same as startVerse for single verses)
 *   translation: string       // Translation code
 * }
 */
function parseVerseReference(reference: string): Array<{
  book: string;
  fullBookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  translation: string;
}> | null {
  let passages: Array<{
    book: string;
    fullBookName: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
    translation: string;
  }> | null = null;

  try {
    // Step 1: Preprocess the reference to handle periods and other formatting issues
    const preprocessed = preprocessBibleReference(reference);

    // Step 2: Convert written numbers to numeric values
    const processedReference = wordsToNumbers(preprocessed, {
      fuzzy: false,
    });

    const textToProcess =
      typeof processedReference === 'string'
        ? processedReference
        : preprocessed;

    console.log('***********');
    console.log('Original reference:', reference);
    console.log('Preprocessed reference:', preprocessed);
    console.log('Processing reference:', textToProcess);

    // Check for "chapter X verse Y" without book name (use context)
    // Match "chapter X verse Y" anywhere in the text (not just at start)
    const chapterVersePattern = /chapter\s+(\d+)[,\s]+verse\s+(\d+)/i;
    const chapterVerseMatch = textToProcess.match(chapterVersePattern);
    if (chapterVerseMatch && lastParsedContext.book) {
      const chapter = parseInt(chapterVerseMatch[1], 10);
      const verse = parseInt(chapterVerseMatch[2], 10);

      console.log('Detected chapter+verse without book:', chapter, verse);
      console.log('Using book from context:', lastParsedContext.book);

      const mappedBook =
        bookMapping[lastParsedContext.book] || lastParsedContext.book;
      passages = [
        {
          book: mappedBook,
          fullBookName: lastParsedContext.book,
          chapter: chapter,
          startVerse: verse,
          endVerse: verse,
          translation: 'default',
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
    if (
      verseOnly !== null &&
      lastParsedContext.book &&
      lastParsedContext.chapter
    ) {
      console.log('Detected verse-only reference:', verseOnly);
      console.log(
        'Using context:',
        lastParsedContext.book,
        lastParsedContext.chapter,
      );

      const mappedBook =
        bookMapping[lastParsedContext.book] || lastParsedContext.book;
      passages = [
        {
          book: mappedBook,
          fullBookName: lastParsedContext.book,
          chapter: lastParsedContext.chapter,
          startVerse: verseOnly,
          endVerse: verseOnly,
          translation: 'default',
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
      console.log('Detected chapter-only reference:', chapterOnly);

      // Try to parse the book name to get the full name
      const bookResult = bcv.parse(chapterOnly.book);
      let fullBookName = chapterOnly.book;

      if (bookResult && bookResult.entities && bookResult.entities.length > 0) {
        const entity = bookResult.entities[0];
        if (entity.passages && entity.passages.length > 0) {
          fullBookName = entity.passages[0].start.b;
        }
      }

      const mappedBook = bookMapping[fullBookName] || fullBookName;
      passages = [
        {
          book: mappedBook,
          fullBookName: fullBookName,
          chapter: chapterOnly.chapter,
          startVerse: 1,
          endVerse: 1,
          translation: 'default',
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
    const result = bcv.parse(textToProcess);
    console.log('Parsed result:', result);
    // Convert to an array if needed
    const results = Array.isArray(result) ? result : [result];
    passages = [];
    results.forEach((item) => {
      if (item.entities) {
        item.entities.forEach((entity) => {
          if (entity.passages) {
            entity.passages.forEach((passageItem) => {
              if (passageItem.valid && passageItem.valid.valid) {
                const translation =
                  entity.translations && entity.translations[0]
                    ? entity.translations[0]
                    : 'default';
                const fullBookName = passageItem.start.b;
                const mappedBook = bookMapping[fullBookName] || fullBookName;
                const verseRange = {
                  book: mappedBook,
                  fullBookName: fullBookName, // Store the full book name for context tracking
                  chapter: passageItem.start.c,
                  startVerse: passageItem.start.v || 1,
                  endVerse: passageItem.end?.v || passageItem.start.v || 1,
                  translation: translation,
                };
                passages.push(verseRange);
              }
            });
          }
        });
      }
    });
    console.log('Processed passages:', passages);
  } catch (error) {
    console.error('Error parsing verse reference:', error);
  }

  // If no passages found and we have a stored context, try parsing with context
  if ((!passages || passages.length === 0) && lastParsedContext.fullReference) {
    console.log('Trying bcv.parse_with_context');
    console.log('  Reference:', reference);
    console.log('  Context:', lastParsedContext.fullReference);
    try {
      const contextResult = bcv.parse_with_context(
        reference,
        lastParsedContext.fullReference,
      );
      console.log('Context search result:', contextResult);
      if (contextResult && contextResult.osis && contextResult.osis()) {
        const osisRef = contextResult.osis();
        console.log('OSIS reference from context:', osisRef);
        // Recursively parse the OSIS reference from the context result
        passages = parseVerseReference(osisRef);
      }
    } catch (error) {
      console.error('Error parsing with context:', error);
    }
  }

  // Also try with the old context variable as a final fallback
  if (
    (!passages || passages.length === 0) &&
    context &&
    context !== reference
  ) {
    console.log('Trying with legacy context:', context);
    try {
      const contextResult = bcv.parse_with_context(reference, context);
      if (contextResult && contextResult.osis && contextResult.osis()) {
        passages = parseVerseReference(contextResult.osis());
      }
    } catch (error) {
      console.error('Error with legacy context:', error);
    }
  }

  // If still no passages and context exists, try regex extraction
  if ((!passages || passages.length === 0) && context) {
    console.log('Trying regex extraction from:', reference);
    const extracted = extractChapterAndVerse(reference);
    console.log('Extracted chapter/verse:', extracted);
    if (extracted.chapter || extracted.verse) {
      const constructedReference = constructReferenceFromExtracted(
        context,
        extracted,
      );
      console.log('Constructed reference:', constructedReference);
      if (constructedReference) {
        try {
          passages = parseVerseReference(constructedReference);
        } catch (error) {
          console.error('Error parsing constructed reference:', error);
        }
      }
    }
  }

  // If we successfully parsed a reference, update the context variables
  if (passages && passages.length > 0) {
    context = reference;

    // Update lastParsedContext with the first passage
    const firstPassage = passages[0];
    lastParsedContext.book = firstPassage.fullBookName || firstPassage.book; // Use fullBookName for context
    lastParsedContext.chapter = firstPassage.chapter;
    lastParsedContext.verse = firstPassage.startVerse;
    lastParsedContext.fullReference = `${firstPassage.book} ${firstPassage.chapter}:${firstPassage.startVerse}`;

    console.log('Updated context:', lastParsedContext);
  }

  return passages && passages.length > 0 ? passages : null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  parseVerseReference,
  preprocessBibleReference,
  isVerseOnlyReference,
  isChapterOnlyReference,
  extractChapterAndVerse,
  constructReferenceFromExtracted,
  lastParsedContext,
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Standard reference
const result1 = parseVerseReference("John 3:16");
// Returns: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16, ... }]

// Example 2: Chapter-only
const result2 = parseVerseReference("Matthew chapter 5");
// Returns: [{ book: "Matthew", chapter: 5, startVerse: 1, endVerse: 1, ... }]

// Example 3: Verse-only (requires context)
parseVerseReference("John 3:16");  // Sets context
const result3 = parseVerseReference("verse 17");
// Returns: [{ book: "John", chapter: 3, startVerse: 17, endVerse: 17, ... }]

// Example 4: Period-separated (speech-to-text)
const result4 = parseVerseReference("Luke. Three. Three.");
// Returns: [{ book: "Luke", chapter: 3, startVerse: 3, endVerse: 3, ... }]

// Example 5: Written numbers
const result5 = parseVerseReference("John chapter three verse sixteen");
// Returns: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 16, ... }]
*/
