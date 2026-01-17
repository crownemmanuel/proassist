# Fix Parser Prompt

## Task

Review the failed test results in `tools/scripture-eval/output/processed_*.failed.jsonl` files and update the parser functions in `tools/scripture-eval/run.mjs` to handle the failing cases.

## Important Constraints

1. **ONLY modify `tools/scripture-eval/run.mjs`** - Do not look beyond the `tools/scripture-eval/` directory
2. **Do NOT modify the main app** (`src/services/smartVersesBibleService.ts`) - we will merge changes later
3. **Skip false positives** - If a failure has `"false_positive": true`, skip it (these are parser issues that incorrectly detect references when none exist)

## Process

1. **Read the failed test file**: `tools/scripture-eval/output/processed_*.failed.jsonl`
2. **Identify real failures**: Filter out entries where `false_positive: true`
3. **Analyze each failure**:
   - Look at `expected_references` (what Groq detected - the ground truth)
   - Look at `parsed_references` (what our parser found - empty means it failed)
   - Look at `text` (the input that failed)
4. **Update parser functions** in `run.mjs`:
   - Functions to potentially modify:
     - `preprocessBibleReference()` - handles initial text normalization
     - `normalizeCommaBetweenChapterAndVerse()` - handles comma patterns
     - `normalizeCommaSeparatedChapterVerse()` - handles "Book 3, 5" -> "Book 3:5"
     - `normalizeBookChapterVersePhrase()` - handles "Book chapter X verse Y"
     - `normalizeSpaceSeparatedChapterVerse()` - handles "Book 3 16" -> "Book 3:16"
     - `normalizeMissingBookChapterSpace()` - handles "Daniel2:16" -> "Daniel 2:16"
     - `normalizeConcatenatedReferences()` - handles "Daniel 2:16Daniel 2:17"
     - `parseVerseReference()` - main parsing logic
   - Add new normalization functions if needed
   - Update the normalization order in `localParseReferences()` if necessary
5. **Test your changes**:
   ```bash
   node tools/scripture-eval/run.mjs --input <input_file> --mode parse
   ```
6. **Iterate**: Keep fixing and re-running until all real failures pass (false positives are skipped automatically)

## False Positive Handling

- **False positives** occur when the parser incorrectly finds references when none exist
- These are marked with `"false_positive": true` in the output
- They are automatically excluded from the pass score
- Focus on fixing real failures first, then address false positives if needed

## Example Failure Analysis

```json
{
  "index": 13,
  "text": "declaring the end from the beginning romans chaper 3, verse 4",
  "expected_references": ["Romans 3:4"],
  "parsed_references": [],
  "pass": false
}
```

**Analysis**:

- Expected: "Romans 3:4"
- Found: Nothing (empty array)
- Issue: "chaper" is a typo for "chapter"
- Fix: Add normalization in `preprocessBibleReference()` to fix "chaper" -> "chapter"

## Success Criteria

- All real failures (non-false-positive) should pass
- Pass score should be 100% (excluding false positives)
- Parser should correctly handle all test cases from the failed.jsonl file

## Notes

- The parser functions are located in `run.mjs` starting around line 273
- The normalization order in `localParseReferences()` (line ~771) must match the order in the main app's `detectAndLookupReferences()` function
- Keep changes focused and minimal - only add what's necessary to fix the failures
- After fixing, re-run the test to verify all failures are resolved
