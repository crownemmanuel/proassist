/**
 * BIBLE REFERENCE PARSER UTILITIES
 * 
 * Renderer-side utility functions for parsing Bible references.
 * This complements the main Bible Pacer functions and provides
 * additional parsing patterns, especially for combined digit formats.
 * 
 * Use this alongside bible-pacer-functions.ts for comprehensive parsing.
 */

import { wordsToNumbers } from 'words-to-numbers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface BibleReference {
  book: string;
  chapter: number;
  verses: number[];
}

interface ParsedReferences {
  references: BibleReference[];
  Text(): string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Bible books regex constant - matches all 66 books of the Bible
const booksRegex =
  '(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|' +
  'Joshua|Judges|Ruth|1\\s*Samuel|2\\s*Samuel|1\\s*Kings|2\\s*Kings|' +
  '1\\s*Chronicles|2\\s*Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|' +
  'Proverbs|Ecclesiastes|Song\\s+of\\s+Solomon|Isaiah|Jeremiah|Lamentations|' +
  'Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|' +
  'Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|' +
  '1\\s*Corinthians|2\\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|' +
  '1\\s*Thessalonians|2\\s*Thessalonians|1\\s*Timothy|2\\s*Timothy|Titus|Philemon|' +
  'Hebrews|James|1\\s*Peter|2\\s*Peter|1\\s*John|2\\s*John|3\\s*John|Jude|Revelation)';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a word (or digits) to a number
 * Handles both numeric strings and written numbers
 * 
 * @param str - String to convert
 * @returns Number or null if conversion fails
 */
function convertToNumber(str: string): number | null {
  str = str.trim();
  let num = parseInt(str, 10);
  if (!isNaN(num)) {
    return num;
  }
  // Try converting written numbers
  const converted = wordsToNumbers(str);
  num = parseInt(converted as string, 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse verse numbers from a string
 * Handles ranges, commas, and written numbers
 * 
 * @param versesStr - String containing verse numbers (e.g., "16", "16-18", "16, 17, 18")
 * @returns Array of verse numbers
 * 
 * @example
 * parseVerses("16") → [16]
 * parseVerses("16-18") → [16, 17, 18]
 * parseVerses("16, 17, 18") → [16, 17, 18]
 * parseVerses("sixteen to eighteen") → [16, 17, 18]
 */
function parseVerses(versesStr: string): number[] {
  // Normalize: lower-case and replace delimiters with commas
  versesStr = versesStr.toLowerCase();
  versesStr = versesStr.replace(/\band\b/g, ',').replace(/&/g, ',');
  
  // Split on commas
  const parts = versesStr.split(/,+/);
  let verses: number[] = [];
  
  parts.forEach((part) => {
    part = part.trim();
    if (!part) return;
    
    // Check for a range like "4-6" or "six to seven"
    const rangeMatch = part.match(/(\w+)\s*(?:-|to)\s*(\w+)/);
    if (rangeMatch) {
      const start = convertToNumber(rangeMatch[1]);
      const end = convertToNumber(rangeMatch[2]);
      if (start !== null && end !== null && start <= end) {
        for (let i = start; i <= end; i++) {
          verses.push(i);
        }
      }
    } else {
      const num = convertToNumber(part);
      if (num !== null) {
        verses.push(num);
      }
    }
  });
  
  // Remove duplicates and sort
  verses = Array.from(new Set(verses));
  verses.sort((a, b) => a - b);
  return verses;
}

// ============================================================================
// MAIN PARSING FUNCTION
// ============================================================================

/**
 * Parse Bible references from input text
 * Supports multiple formats including combined digits
 * 
 * @param input - Text containing Bible references
 * @returns ParsedReferences object with references array and Text() method
 * 
 * Supported formats:
 * - Standard: "John 3:16", "Romans 8:28-30"
 * - Word-based: "John chapter three verse sixteen"
 * - Combined digits: "Luke 611" → Luke 6:11
 * - Multiple references in one string
 * 
 * @example
 * ```typescript
 * const result = parseBibleReferences("Turn to John 3:16 and Romans 8:28");
 * console.log(result.references);
 * // [
 * //   { book: "John", chapter: 3, verses: [16] },
 * //   { book: "Romans", chapter: 8, verses: [28] }
 * // ]
 * 
 * console.log(result.Text());
 * // "John 3:16\nRomans 8:28"
 * ```
 */
export function parseBibleReferences(input: string): ParsedReferences {
  // Normalize input: replace periods/commas with spaces, clean up whitespace
  const normalized = input.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const references: BibleReference[] = [];

  // Pattern 1: Colon format (e.g., "John 3:16", "John 3:4-6")
  const colonRegex = new RegExp(
    `(?:\\b(?:the\\s+)?(?:book\\s+of\\s+))?(?<book>${booksRegex})\\s+(?<chapter>\\w+)\\s*:\\s*(?<verses>[\\w\\s\\-\\&to,]+)`,
    'gi',
  );

  // Pattern 2: Word-based format
  // Accepts either explicit keyword (verse|verses|vs) or comma after chapter
  // Examples:
  //   - "John, chapter three, verse six" (explicit keyword)
  //   - "Ezekiel, chapter five, six" (comma used instead of "verse")
  const wordRegex = new RegExp(
    `(?:\\b(?:the\\s+)?(?:book\\s+of\\s+))?` +
      `(?<book>${booksRegex})\\s*,?\\s*` +
      `(?:chapter|ch)\\s+(?<chapter>\\w+)` +
      `(?:(?:\\s*(?:from\\s+)?(?:[:]?\\s*(?:verse|verses|vs))\\s+)|(?:\\s*,\\s+))` +
      `(?<verses>[\\w\\s\\-\\&to,]+)`,
    'gi',
  );

  // Pattern 3: Combined digits (e.g., "Luke 611" meaning Luke 6:11)
  // Handles 3-5 digit numbers where first 1-2 digits are chapter, rest is verse
  const combinedRegex = new RegExp(
    `(?:\\b(?:the\\s+)?(?:book\\s+of\\s+))?(?<book>${booksRegex})\\s+(?<combined>\\d{3,5})\\b`,
    'gi',
  );

  // Process colon format matches
  let match: RegExpExecArray | null;
  while ((match = colonRegex.exec(normalized)) !== null) {
    const { book, chapter, verses } = match.groups as { [key: string]: string };
    const chNum = convertToNumber(chapter);
    if (chNum !== null) {
      const verseNums = parseVerses(verses);
      references.push({ book: book.trim(), chapter: chNum, verses: verseNums });
    }
  }

  // Process word-based format matches
  while ((match = wordRegex.exec(normalized)) !== null) {
    const { book, chapter, verses } = match.groups as { [key: string]: string };
    const chNum = convertToNumber(chapter);
    if (chNum !== null) {
      const verseNums = parseVerses(verses);
      references.push({ book: book.trim(), chapter: chNum, verses: verseNums });
    }
  }

  // Process combined digit format matches
  while ((match = combinedRegex.exec(normalized)) !== null) {
    const { book, combined } = match.groups as { [key: string]: string };
    
    // Skip Psalms as it may legitimately use higher chapter numbers
    if (book.trim().toLowerCase() === 'psalms') {
      continue;
    }
    
    let chapter: number | null = null;
    let verseStr = '';
    
    if (combined.length === 3) {
      // E.g., "611" → chapter = 6, verses = "11"
      chapter = parseInt(combined.charAt(0), 10);
      verseStr = combined.slice(1);
    } else if (combined.length === 4) {
      // E.g., "1213" → chapter = 12, verses = "13"
      chapter = parseInt(combined.slice(0, 2), 10);
      verseStr = combined.slice(2);
    } else if (combined.length === 5) {
      // Fallback: assume chapter is first 2 digits, remaining is the verse
      chapter = parseInt(combined.slice(0, 2), 10);
      verseStr = combined.slice(2);
    }
    
    const verseNums = parseVerses(verseStr);
    if (chapter !== null && verseNums.length > 0) {
      references.push({ book: book.trim(), chapter, verses: verseNums });
    }
  }

  return {
    references,
    Text(): string {
      if (!references.length) {
        // Remove the word "is" (with word boundaries) and trim extra spaces
        return input
          .replace(/\bis\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return references
        .map((ref) => `${ref.book} ${ref.chapter}:${ref.verses.join(',')}`)
        .join('\n');
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BibleReference,
  ParsedReferences,
  parseVerses,
  convertToNumber,
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Standard format
const result1 = parseBibleReferences("John 3:16");
console.log(result1.references);
// [{ book: "John", chapter: 3, verses: [16] }]

// Example 2: Range
const result2 = parseBibleReferences("Romans 8:28-30");
console.log(result2.references);
// [{ book: "Romans", chapter: 8, verses: [28, 29, 30] }]

// Example 3: Multiple references
const result3 = parseBibleReferences("John 3:16 and Romans 8:28");
console.log(result3.references);
// [
//   { book: "John", chapter: 3, verses: [16] },
//   { book: "Romans", chapter: 8, verses: [28] }
// ]

// Example 4: Combined digits
const result4 = parseBibleReferences("Luke 611");
console.log(result4.references);
// [{ book: "Luke", chapter: 6, verses: [11] }]

// Example 5: Word-based
const result5 = parseBibleReferences("John chapter three verse sixteen");
console.log(result5.references);
// [{ book: "John", chapter: 3, verses: [16] }]

// Example 6: Get formatted text
const result6 = parseBibleReferences("John 3:16");
console.log(result6.Text());
// "John 3:16"
*/
