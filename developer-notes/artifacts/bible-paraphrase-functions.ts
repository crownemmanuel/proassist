/**
 * BIBLE PARAPHRASE DETECTION AND KEY POINT EXTRACTION FUNCTIONS
 * 
 * Complete implementation of AI-powered transcript analysis:
 * 1. Detect paraphrased Bible verses
 * 2. Extract key quotable points
 * 
 * These functions use Groq AI (Llama 3.3 70B) via LangChain.
 */

import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error('GROQ_API_KEY must be defined in the environment variables.');
}

// Initialize the Groq model
const model = new ChatGroq({
  model: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  apiKey,
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Interface for paraphrased verse detection result
 */
export interface ParaphrasedVerse {
  reference: string;        // e.g., "John 3:16"
  confidence: number;        // 0.0 to 1.0
  matchedPhrase: string;    // Portion of transcript that matches
}

/**
 * Interface for key point extraction result
 */
export interface KeyPoint {
  text: string;
  category: 'quote' | 'action' | 'principle' | 'encouragement';
}

/**
 * Interface for transcript analysis result
 */
export interface TranscriptAnalysisResult {
  paraphrasedVerses: ParaphrasedVerse[];
  keyPoints: KeyPoint[];
}

// ============================================================================
// JSON SCHEMA DEFINITIONS
// ============================================================================

// Define the JSON schema for transcript analysis output
const transcriptAnalysisParser = new JsonOutputParser({
  schema: {
    type: 'object',
    properties: {
      paraphrasedVerses: {
        type: 'array',
        description: 'Array of Bible verses that appear to be paraphrased in the text',
        items: {
          type: 'object',
          properties: {
            reference: { 
              type: 'string',
              description: 'The Bible reference (e.g., "John 3:16", "Romans 8:28")'
            },
            confidence: { 
              type: 'number',
              description: 'Confidence score from 0 to 1 indicating how likely this is a paraphrase'
            },
            matchedPhrase: { 
              type: 'string',
              description: 'The portion of the transcript that matches the verse'
            },
          },
          required: ['reference', 'confidence', 'matchedPhrase'],
        },
      },
      keyPoints: {
        type: 'array',
        description: 'Array of key quotable points from the sermon',
        items: {
          type: 'object',
          properties: {
            text: { 
              type: 'string',
              description: 'The quotable phrase or key point'
            },
            category: { 
              type: 'string',
              description: 'Category of the key point: "quote", "action", "principle", "encouragement"'
            },
          },
          required: ['text', 'category'],
        },
      },
    },
    required: ['paraphrasedVerses', 'keyPoints'],
  },
});

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

// Create transcript analysis prompt template
const transcriptAnalysisPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert Bible scholar and sermon analyst. Your task is to analyze sermon transcripts to:

1. DETECT PARAPHRASED BIBLE VERSES: Identify when the speaker is paraphrasing or alluding to specific Bible verses without directly quoting them. Be conservative - only identify clear paraphrases, not vague thematic connections.

2. EXTRACT KEY POINTS: Identify quotable, actionable, or memorable statements that would make good lower-thirds or social media quotes. Focus on:
   - Powerful declarative statements
   - Actionable life principles
   - Encouraging or uplifting phrases
   - Memorable one-liners
   
Categories for key points:
- "quote": A memorable, shareable statement
- "action": An actionable step or call to action  
- "principle": A life principle or teaching point
- "encouragement": An encouraging or uplifting statement

Be selective - only extract truly quotable content, not generic statements.

Return your response in JSON format using this schema: ${transcriptAnalysisParser.getFormatInstructions()}

IMPORTANT RULES:
- For paraphrased verses, only return up to 3 most confident matches
- Only include paraphrased verses with confidence >= 0.6
- For key points, only extract genuinely quotable content (max 2 per chunk)
- If nothing is found, return empty arrays
- Always use proper Bible reference format (e.g., "John 3:16", "Romans 8:28-30")`,
  ],
  ['human', 'Analyze this sermon transcript chunk:\n\n"{transcriptChunk}"'],
]);

// Create the LangChain chain
const transcriptAnalysisChain = transcriptAnalysisPrompt.pipe(model).pipe(transcriptAnalysisParser);

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyzes a transcript chunk to detect paraphrased Bible verses and extract key points
 * 
 * @param transcriptChunk - The transcript text to analyze
 * @param detectParaphrases - Whether to detect paraphrased Bible verses (default: true)
 * @param extractKeyPoints - Whether to extract key quotable points (default: true)
 * @returns A promise that resolves to the analysis result
 * 
 * @example
 * ```typescript
 * const result = await analyzeTranscriptChunk(
 *   "God so loved the world that he gave his only son",
 *   true,  // detect paraphrases
 *   true   // extract key points
 * );
 * 
 * // Result:
 * // {
 * //   paraphrasedVerses: [
 * //     { reference: "John 3:16", confidence: 0.95, matchedPhrase: "God so loved the world" }
 * //   ],
 * //   keyPoints: [
 * //     { text: "God's love is sacrificial", category: "principle" }
 * //   ]
 * // }
 * ```
 */
export async function analyzeTranscriptChunk(
  transcriptChunk: string,
  detectParaphrases: boolean = true,
  extractKeyPoints: boolean = true
): Promise<TranscriptAnalysisResult> {
  console.log('========================================');
  console.log('🤖 AI TRANSCRIPT ANALYSIS - START');
  console.log('========================================');
  console.log('📥 Input chunk:', transcriptChunk);
  console.log('📥 detectParaphrases:', detectParaphrases);
  console.log('📥 extractKeyPoints:', extractKeyPoints);
  
  // Return empty results if nothing to analyze or both options disabled
  if (!transcriptChunk.trim() || (!detectParaphrases && !extractKeyPoints)) {
    console.log('⚠️ Skipping - empty chunk or both options disabled');
    return { paraphrasedVerses: [], keyPoints: [] };
  }

  // Skip very short chunks (less than 10 words)
  const wordCount = transcriptChunk.trim().split(/\s+/).length;
  if (wordCount < 10) {
    console.log('⚠️ Skipping AI analysis - chunk too short:', wordCount, 'words');
    return { paraphrasedVerses: [], keyPoints: [] };
  }

  console.log('📊 Word count:', wordCount);
  console.log('🚀 Sending to Groq AI...');

  try {
    const startTime = Date.now();
    
    const response = await transcriptAnalysisChain.invoke({
      transcriptChunk: transcriptChunk,
    }) as TranscriptAnalysisResult;

    const duration = Date.now() - startTime;
    
    console.log('========================================');
    console.log('📨 RAW AI RESPONSE:');
    console.log(JSON.stringify(response, null, 2));
    console.log('========================================');
    console.log('⏱️ Response time:', duration, 'ms');

    // Filter results based on what was requested
    const result: TranscriptAnalysisResult = {
      paraphrasedVerses: detectParaphrases ? (response.paraphrasedVerses || []) : [],
      keyPoints: extractKeyPoints ? (response.keyPoints || []) : [],
    };

    console.log('📤 Before filtering:');
    console.log('   - Paraphrased verses:', result.paraphrasedVerses.length);
    console.log('   - Key points:', result.keyPoints.length);

    // Filter paraphrased verses by confidence threshold
    result.paraphrasedVerses = result.paraphrasedVerses
      .filter(v => v.confidence >= 0.6)
      .slice(0, 3); // Maximum 3 verses

    // Limit key points
    result.keyPoints = result.keyPoints.slice(0, 2);

    console.log('📤 After filtering (confidence >= 0.6, max 3 verses, max 2 key points):');
    console.log('   - Paraphrased verses:', result.paraphrasedVerses.length);
    if (result.paraphrasedVerses.length > 0) {
      result.paraphrasedVerses.forEach((v, i) => {
        console.log(`     [${i}] ${v.reference} (${Math.round(v.confidence * 100)}%): "${v.matchedPhrase}"`);
      });
    }
    console.log('   - Key points:', result.keyPoints.length);
    if (result.keyPoints.length > 0) {
      result.keyPoints.forEach((kp, i) => {
        console.log(`     [${i}] [${kp.category}] "${kp.text}"`);
      });
    }

    console.log('========================================');
    console.log('🤖 AI TRANSCRIPT ANALYSIS - COMPLETE');
    console.log('========================================');

    return result;
  } catch (error) {
    console.error('========================================');
    console.error('❌ AI TRANSCRIPT ANALYSIS - ERROR');
    console.error('========================================');
    console.error('Error details:', error);
    return { paraphrasedVerses: [], keyPoints: [] };
  }
}

// ============================================================================
// AI BIBLE SEARCH FUNCTION
// ============================================================================

/**
 * JSON schema parser for Bible search queries
 */
const bibleSearchParser = new JsonOutputParser({
  schema: {
    type: 'object',
    properties: {
      verses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            reference: { type: 'string' },
            highlight: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['reference'],
        },
      },
    },
    required: ['verses'],
  },
});

// Create a Bible-focused prompt template for search
const bibleSearchPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a Bible assistant that helps users find relevant Bible passages. Return responses in JSON format using this schema: ${bibleSearchParser.getFormatInstructions()}. 
    The 'verses' array should contain objects with 'reference' (e.g. "John 3:16") and if the user requests is a search for words, 'highlight' should contain the words to highlight that match user's request.
    The 'highlight' array should contain strings of text to highlight in the response.`,
  ],
  ['human', '{question}'],
]);

// Create the search chain
const bibleSearchChain = bibleSearchPrompt.pipe(model).pipe(bibleSearchParser);

/**
 * Generates a Bible-focused response using the Groq API via Langchain
 * Useful for natural language queries like "What does the Bible say about love?"
 * 
 * @param question - The Bible-related question to ask
 * @returns A promise that resolves to the generated response with Bible references in JSON format
 * 
 * @example
 * ```typescript
 * const response = await generateBibleResponse("What does the Bible say about love?");
 * // Returns: JSON string with verse references
 * ```
 */
export async function generateBibleResponse(question: string): Promise<string> {
  try {
    const response = await bibleSearchChain.invoke({
      question: question,
    });
    return JSON.stringify(response);
  } catch (error) {
    console.error('Error generating Bible response:', error);
    throw new Error('Failed to generate Bible response. Please try again.');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TranscriptAnalysisResult,
  ParaphrasedVerse,
  KeyPoint,
  generateBibleResponse,
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// Example 1: Detect paraphrased verses only
const result1 = await analyzeTranscriptChunk(
  "You know, the Bible says that God loved us so much that he sent his son",
  true,  // detect paraphrases
  false  // don't extract key points
);
// Returns paraphrased verses with confidence scores

// Example 2: Extract key points only
const result2 = await analyzeTranscriptChunk(
  "Remember, faith without works is dead. You must act on what you believe.",
  false, // don't detect paraphrases
  true   // extract key points
);
// Returns key points with categories

// Example 3: Both features enabled
const result3 = await analyzeTranscriptChunk(
  "As it says in Romans, nothing can separate us from God's love. This is a powerful truth we need to hold onto.",
  true,  // detect paraphrases
  true   // extract key points
);
// Returns both paraphrased verses and key points

// Example 4: AI Bible search
const searchResult = await generateBibleResponse("What does the Bible say about forgiveness?");
// Returns JSON with relevant verse references
*/
