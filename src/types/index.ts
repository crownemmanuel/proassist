export type LayoutType =
  | "one-line"
  | "two-line"
  | "three-line"
  | "four-line"
  | "five-line"
  | "six-line";

export type TemplateType = "text" | "image" | "video";

export interface Slide {
  id: string;
  text: string; // Can be multi-line, actual rendering will depend on layout
  layout: LayoutType;
  order: number; // To maintain order within a playlist item
}

export interface PlaylistItem {
  // This seems to represent a collection of slides generated from one import/template application
  id: string;
  title: string; // Derived from import or manually set
  templateName: string;
  templateColor: string; // From the template used
  slides: Slide[];
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[]; // A playlist contains multiple "PlaylistItems" which are groups of slides
}

export interface Template {
  id: string;
  name: string;
  color: string;
  type: TemplateType;
  logic?: string; // Could be a path to a script, regex, or other rules
  availableLayouts: LayoutType[];
  aiPrompt?: string; // User-defined prompt for AI processing
  processWithAI?: boolean; // If true, use AI for slide generation
  outputPath: string;
  outputFileNamePrefix: string;
}

export interface AppSettings {
  theme: "light" | "dark";
  openAIConfig?: AIServiceConfig; // Stores API key for OpenAI
  geminiConfig?: AIServiceConfig; // Stores API key for Gemini
  defaultAIProvider?: AIProvider; // User's preferred default AI if multiple are configured
  // Other global settings can be added here
}

export interface ProPresenterData {
  liveSlideText: string;
  // Potentially other fields ProPresenter needs
}

export type AIProvider = "openai" | "gemini" | null;

export interface AIServiceConfig {
  // provider: AIProvider; // Redundant if keys are specific e.g. openAIAPIKey
  apiKey: string;
}
