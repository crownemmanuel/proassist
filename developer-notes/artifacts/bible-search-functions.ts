/**
 * BIBLE SEARCH FUNCTIONS
 * 
 * Full-text search implementation for Bible verses using FlexSearch.
 * This provides fast keyword-based search across all Bible verses.
 * 
 * Alternative: See bibleparaphraseer/verse-detector/ for semantic search using embeddings.
 */

import FlexSearch from 'flexsearch';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface VerseMapEntry {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface SearchResult {
  reference: string;
  text: string;
}

// ============================================================================
// SEARCH INDEX CLASS
// ============================================================================

export class BibleSearchIndex {
  private bibleIndex: any = null;
  private verseMap: { [key: string]: VerseMapEntry } = {};
  private isIndexed: boolean = false;

  /**
   * Create search index from Bible data
   * 
   * @param bibleData - Bible data in JSON format
   * 
   * Bible data format:
   * [
   *   {
   *     name: "Genesis",
   *     abbrev: "Gen",
   *     chapters: [
   *       ["In the beginning...", "And the earth was...", ...],  // Chapter 1 verses
   *       ["Thus the heavens...", ...],                          // Chapter 2 verses
   *       ...
   *     ]
   *   },
   *   ...
   * ]
   */
  createSearchIndex(bibleData: any[]): void {
    if (this.isIndexed) {
      console.log('Using existing Bible index.');
      return;
    }

    try {
      // Initialize FlexSearch document index
      this.bibleIndex = new FlexSearch.Document({
        document: {
          id: 'id',
          index: ['text'],
        },
        tokenize: 'forward',
        encoder: 'simple',
        cache: true,
      });

      // Wrap single book object in array if needed
      if (!Array.isArray(bibleData)) {
        bibleData = [bibleData];
      }

      // Clear previous index mapping
      this.verseMap = {};

      // Iterate over each book, chapter, and verse
      bibleData.forEach((book) => {
        if (book.chapters) {
          book.chapters.forEach((chapter: string[], chapterIndex: number) => {
            chapter.forEach((verse: string, verseIndex: number) => {
              const verseId = `${book.abbrev}-${chapterIndex + 1}-${verseIndex + 1}`;
              
              // Save the reference details
              this.verseMap[verseId] = {
                book: book.name,
                chapter: chapterIndex + 1,
                verse: verseIndex + 1,
                text: verse,
              };
              
              // Add the verse text to the index
              this.bibleIndex.add({
                id: verseId,
                text: verse,
              });
            });
          });
        }
      });

      this.isIndexed = true;
      console.log('Bible indexed successfully.');
    } catch (err) {
      console.error('Error indexing Bible:', err);
      this.isIndexed = false;
    }
  }

  /**
   * Search Bible verses by query string
   * 
   * @param query - Search query string
   * @returns Array of search results with reference and text
   * 
   * @example
   * ```typescript
   * const results = searchBible("love");
   * // Returns: [
   * //   { reference: "John 3:16", text: "For God so loved the world..." },
   * //   { reference: "1 Corinthians 13:4", text: "Love is patient..." },
   * //   ...
   * // ]
   * ```
   */
  searchBible(query: string): SearchResult[] {
    if (!this.bibleIndex) {
      console.error('Bible index not created.');
      return [];
    }

    const results: SearchResult[] = [];
    const searchResults = this.bibleIndex.search(query);
    
    console.log('Search results:', searchResults);
    
    searchResults.forEach((resultObj: any) => {
      resultObj.result.forEach((id: string) => {
        const result = this.verseMap[id];
        if (result) {
          console.log(
            'reference',
            `${result.book} ${result.chapter}:${result.verse}`,
          );
          results.push({
            reference: `${result.book} ${result.chapter}:${result.verse}`,
            text: result.text,
          });
        }
      });
    });

    return results;
  }

  /**
   * Check if index is ready
   */
  isReady(): boolean {
    return this.isIndexed;
  }

  /**
   * Clear the search index
   */
  clearIndex(): void {
    this.bibleIndex = null;
    this.verseMap = {};
    this.isIndexed = false;
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Basic usage
const searchIndex = new BibleSearchIndex();

// Load Bible data (from your Bible JSON file)
const bibleData = await loadBibleData('en_kjv.json');

// Create index
searchIndex.createSearchIndex(bibleData);

// Search
const results = searchIndex.searchBible("love");
console.log('Found', results.length, 'verses containing "love"');

// Example 2: Multiple searches
const results1 = searchIndex.searchBible("faith");
const results2 = searchIndex.searchBible("hope");
const results3 = searchIndex.searchBible("charity");

// Example 3: Phrase search
const results4 = searchIndex.searchBible("God so loved");
*/
