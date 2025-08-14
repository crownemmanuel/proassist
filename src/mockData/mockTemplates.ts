import { Template } from "../types";

const mockTemplates: Template[] = [
  {
    id: "template-1",
    name: "Basic Song Lyrics",
    color: "#3498db",
    type: "text", // Was "Simple"
    availableLayouts: ["one-line", "two-line", "four-line"],
    logic: "", // No specific logic for simple text
    aiPrompt: "",
    processWithAI: false,
    outputPath: "/Users/emmanuelcrown/Documents/ProPresenterOutput/Lyrics",
    outputFileNamePrefix: "SongLyric",
  },
  {
    id: "template-2",
    name: "Bible Verse",
    color: "#2ecc71",
    type: "text", // Was "Regex"
    availableLayouts: ["two-line", "three-line"],
    logic: "([A-Za-z]+ d+:d+)", // Example: Book Chapter:Verse
    aiPrompt: "Format this bible verse appropriately for a presentation slide.",
    processWithAI: false, // Can be true if we want AI to also process regex-matched content
    outputPath: "/Users/emmanuelcrown/Documents/ProPresenterOutput/Verses",
    outputFileNamePrefix: "Verse",
  },
  {
    id: "template-3",
    name: "Sermon Points",
    color: "#e67e22",
    type: "text", // Was "JavaScript Formula"
    availableLayouts: [
      "one-line",
      "two-line",
      "three-line",
      "four-line",
      "five-line",
      "six-line",
    ],
    logic: "input.toUpperCase()", // Example: Convert text to uppercase
    aiPrompt:
      "Break down the following sermon notes into concise points, each suitable for a slide. Use appropriate layouts.",
    processWithAI: true, // Let AI handle sermon points structuring
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    outputPath: "/Users/emmanuelcrown/Documents/ProPresenterOutput/SermonNotes",
    outputFileNamePrefix: "SermonPoint",
  },
  {
    id: "template-4",
    name: "AI Generated Lower Third",
    color: "#9b59b6",
    type: "text", // Was "AI Powered"
    availableLayouts: ["one-line", "two-line"],
    aiPrompt:
      "Create a lower third title and subtitle from the following text. Title on the first line, subtitle on the second.",
    processWithAI: true,
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    outputPath: "/Users/emmanuelcrown/Documents/ProPresenterOutput/LowerThirds",
    outputFileNamePrefix: "LowerThird",
  },
  {
    id: "template-5",
    name: "Default Fallback",
    color: "#7f8c8d",
    type: "text",
    availableLayouts: [
      "one-line",
      "two-line",
      "three-line",
      "four-line",
      "five-line",
      "six-line",
    ],
    aiPrompt: "Present this text clearly.",
    processWithAI: false,
    outputPath: "/Users/emmanuelcrown/Documents/ProPresenterOutput/Default",
    outputFileNamePrefix: "Slide",
  },
];

export default mockTemplates;
