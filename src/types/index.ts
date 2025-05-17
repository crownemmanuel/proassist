export type LayoutType =
  | "one-line"
  | "two-line"
  | "three-line"
  | "four-line"
  | "five-line"
  | "six-line";

export type TemplateType =
  | "Simple"
  | "Regex"
  | "JavaScript Formula"
  | "AI Powered";

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
  logic: string; // Regex string, JS code, or AI prompt
  availableLayouts: LayoutType[]; // Layouts this template can produce/assign
  prompt?: string; // Optional, for AI Powered templates
  outputPath: string; // New: Path to save generated files
  outputFileNamePrefix: string; // New: Prefix for generated file names
}

// Example for AI Powered template logic (could be part of a more specific type)
export interface AIPoweredTemplate extends Template {
  type: "AI Powered";
  prompt: string; // The base prompt
}

export interface AppSettings {
  templates: Template[];
  // other global settings
}

export interface ProPresenterData {
  liveSlideText: string;
  // Potentially other fields ProPresenter needs
}
