import { AppSettings, Template, LayoutType, Slide } from "../types";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JsonOutputFunctionsParser } from "langchain/output_parsers";

interface AISlide {
  text: string;
  layout: LayoutType;
}

/**
 * Generates slides from input text using an AI model based on the selected template and app settings.
 *
 * @param inputText The raw text to be processed into slides.
 * @param template The template guiding the AI, including the custom prompt and available layouts.
 * @param appSettings The application settings containing AI provider configurations and API keys.
 * @returns A promise that resolves to an array of objects, each representing a slide with `text` and `layout`.
 *          Returns an empty array if AI processing is not applicable or fails.
 */
export const generateSlidesFromText = async (
  inputText: string,
  template: Template,
  appSettings: AppSettings
): Promise<Pick<Slide, "text" | "layout">[]> => {
  if (!template.processWithAI || !template.aiPrompt) {
    console.warn(
      "Template is not configured for AI processing or AI prompt is missing."
    );
    return [];
  }

  // Use provider from template, fallback to appSettings default, then error if none
  const provider = template.aiProvider || appSettings.defaultAIProvider;
  const modelName = template.aiModel; // Model must be specified in template if provider is

  if (!provider) {
    console.error(
      "AI provider is not configured in the template or app settings."
    );
    alert(
      "AI provider is not configured for this template. Please edit the template or check global AI settings."
    );
    return [];
  }

  if (template.aiProvider && !modelName) {
    console.error(
      `AI model is not specified in the template ('${template.name}') for the selected provider '${provider}'.`
    );
    alert(
      `AI model not specified for template '${template.name}'. Please edit the template to select a model for '${provider}'.`
    );
    return [];
  }

  let apiKey: string | undefined;
  if (provider === "openai") {
    apiKey = appSettings.openAIConfig?.apiKey;
  } else if (provider === "gemini") {
    apiKey = appSettings.geminiConfig?.apiKey;
  }

  if (!provider || !apiKey) {
    console.error("AI provider or API key is not configured.");
    alert(
      "AI provider or API key is not configured. Please check AI settings."
    );
    return [];
  }

  let llm;
  try {
    if (provider === "openai") {
      llm = new ChatOpenAI({
        apiKey: apiKey,
        modelName: modelName || "gpt-4o-mini", // Fallback to a default OpenAI model if somehow not set
        temperature: 0.7,
      });
    } else if (provider === "gemini") {
      llm = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: modelName || "gemini-1.5-flash-latest", // Fallback to a default Gemini model
        temperature: 0.7,
      });
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    console.error("Error initializing LLM:", error);
    alert(
      `Error initializing LLM: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }

  const outputParser = new JsonOutputFunctionsParser<{ slides: AISlide[] }>();
  const runnable = llm
    .bind({
      functions: [
        {
          name: "slide_generator",
          description:
            "Generates an array of slides based on the input text and available layouts.",
          parameters: {
            type: "object",
            properties: {
              slides: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      description:
                        "The content/text for the slide. Each line of text should be separated by a newline character (\\n).",
                    },
                    layout: {
                      type: "string",
                      enum: template.availableLayouts,
                      description:
                        "The layout type to be applied to this slide.",
                    },
                  },
                  required: ["text", "layout"],
                },
              },
            },
            required: ["slides"],
          },
        },
      ],
      function_call: { name: "slide_generator" },
    })
    .pipe(outputParser);

  const systemPrompt = `You are an assistant that helps create presentation slides. Your goal is to take the user\'s raw text and their specific instructions, then break it down into well-structured slides.
For each slide, you must choose an appropriate layout from the provided list: ${template.availableLayouts.join(
    ", "
  )}.
Crucially, the \'text\' provided for a slide MUST match the capacity of the chosen layout.
- If you choose a \'one-line\' layout, the \'text\' field must contain a single line of text.
- If you choose a \'two-line\' layout, the \'text\' field must contain two lines of text, separated by a newline character (\\n).
- If you choose a \'three-line\' layout, the \'text\' field must contain three lines of text, each separated by a newline character (\\n).
- And so on for other multi-line layouts.
The user\'s custom instructions/prompt are: "${
    template.aiPrompt
  }". Adhere to these instructions carefully, ensuring your text generation respects the chosen layout\'s line count.
Ensure the output is a JSON object containing a \'slides\' array, where each item has \'text\' (formatted as described) and a \'layout\'.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(inputText),
  ];

  try {
    console.log(
      "Invoking AI with prompt:",
      systemPrompt,
      "Input text:",
      inputText
    );
    const result = await runnable.invoke(messages);
    console.log("AI Result:", result);

    if (result && result.slides && Array.isArray(result.slides)) {
      // Validate each slide object structure if necessary
      return result.slides.map((s) => ({ text: s.text, layout: s.layout }));
    }
    console.error("AI response did not match expected structure:", result);
    alert("AI response structure was unexpected. Check console for details.");
    return [];
  } catch (error) {
    console.error("Error processing text with AI:", error);
    alert(
      `Error from AI: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
};

/**
 * Generate a JavaScript or regex snippet from a natural-language description.
 * Returns raw code only (no fencing/explanations) or an empty string on error.
 */
export const generateLogicSnippet = async (
  description: string,
  outputType: "regex" | "javascript",
  providerFromUser: "openai" | "gemini" | undefined,
  modelFromUser: string | undefined,
  appSettings: AppSettings
): Promise<string> => {
  const provider =
    providerFromUser || appSettings.defaultAIProvider || undefined;
  if (!provider) return "";

  let apiKey: string | undefined;
  if (provider === "openai") apiKey = appSettings.openAIConfig?.apiKey;
  if (provider === "gemini") apiKey = appSettings.geminiConfig?.apiKey;
  if (!apiKey) return "";

  try {
    const system =
      outputType === "regex"
        ? "You are a JavaScript regex expert. STRICT FORMAT: Return ONLY a valid JavaScript regex literal in the form /pattern/flags. No prose, no code fences, no explanation. The regex will be used to split or capture sections from a single string variable named 'input'."
        : "You are a senior JavaScript engineer. STRICT FORMAT: Return ONLY a minimal JavaScript snippet (no backticks, no comments, no prose) that, when executed as a function body, returns either string[] or { text: string, layout?: string }[]. Assume there is a single input string variable named 'input'. The snippet must end with a return statement.";

    if (provider === "openai") {
      const llm = new ChatOpenAI({
        apiKey,
        modelName: modelFromUser || "gpt-4o-mini",
        temperature: 0.3,
      });
      const messages = [
        new SystemMessage(system),
        new HumanMessage(description),
      ];
      const res = await llm.invoke(messages);
      const text =
        (res as any)?.content?.[0]?.text ?? (res as any)?.content ?? "";
      return typeof text === "string" ? text.trim() : "";
    }
    if (provider === "gemini") {
      const llm = new ChatGoogleGenerativeAI({
        apiKey,
        model: modelFromUser || "gemini-1.5-flash-latest",
        temperature: 0.3,
      });
      const messages = [
        new SystemMessage(system),
        new HumanMessage(description),
      ];
      const res = await llm.invoke(messages);
      const text =
        (res as any)?.content?.[0]?.text ?? (res as any)?.content ?? "";
      return typeof text === "string" ? text.trim() : "";
    }
  } catch (err) {
    console.error("generateLogicSnippet error:", err);
    return "";
  }
  return "";
};

/**
 * Fetch available model ids from OpenAI (v1/models). Filters to common chat models.
 */
export const fetchOpenAIModels = async (apiKey: string): Promise<string[]> => {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ids: string[] = (data?.data || []).map((m: any) => m.id);
    // keep likely chat/gen models
    return ids
      .filter((id) => /gpt|o\d|^gpt-4|^gpt-3|^o3|^o1|^gpt-4o/.test(id))
      .sort();
  } catch (err) {
    console.error("fetchOpenAIModels failed:", err);
    return [];
  }
};

/**
 * Fetch available Gemini model ids.
 */
export const fetchGeminiModels = async (apiKey: string): Promise<string[]> => {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ids: string[] = (data?.models || []).map(
      (m: any) => m.name || m.displayName || m.id
    );
    return ids.sort();
  } catch (err) {
    console.error("fetchGeminiModels failed:", err);
    return [];
  }
};
