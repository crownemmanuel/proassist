import { LiveSlide } from "../types/liveSlides";

// Slide colors palette - matches Rust backend
const SLIDE_COLORS = [
  "#3B82F6", // Blue
  "#F59E0B", // Yellow/Amber
  "#EC4899", // Pink
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

/**
 * Parse notepad text into slides
 *
 * Parsing Rules:
 * - Empty line = New slide boundary
 * - Tab or 4 spaces at start = Indented child item
 * - Regular text = Parent line
 *
 * When a parent line has indented children:
 * - First slide: Parent only
 * - Then: One slide per child, each with parent + that child
 *
 * Example:
 * "Line A\nLine B" → Slide 1: [Line A], Slide 2: [Line B]
 * "Line A\n\nLine B" → Slide 1: [Line A], Slide 2: [Line B]
 * "Parent\n\tChild1\n\tChild2" → Slide 1: [Parent], Slide 2: [Parent, ↳Child1], Slide 3: [Parent, ↳Child2]
 */
export function parseNotepadText(text: string): LiveSlide[] {
  const slides: LiveSlide[] = [];
  let colorIndex = 0;

  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      // Empty line = new slide boundary
      i++;
      continue;
    }

    if (line.startsWith("\t") || line.startsWith("    ")) {
      // Orphaned indented line (no parent) - treat as regular line
      const trimmed = line.replace(/^(\t|    )/, "").trimStart();
      slides.push({
        items: [
          {
            text: trimmed,
            is_sub_item: false,
          },
        ],
        color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
      });
      colorIndex++;
      i++;
    } else {
      // Regular line - this is a parent
      const parentText = line;

      // Collect all immediately following indented lines
      const children: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.trim() === "") {
          break; // Empty line stops the group
        }
        if (nextLine.startsWith("\t") || nextLine.startsWith("    ")) {
          const trimmed = nextLine.replace(/^(\t|    )/, "").trimStart();
          children.push(trimmed);
          j++;
        } else {
          break; // Non-indented line stops the group
        }
      }

      if (children.length === 0) {
        // No children - create single slide with just parent
        slides.push({
          items: [
            {
              text: parentText,
              is_sub_item: false,
            },
          ],
          color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
        });
        colorIndex++;
      } else {
        // Has children - create parent-only slide first, then one slide per child
        // First: parent-only slide
        slides.push({
          items: [
            {
              text: parentText,
              is_sub_item: false,
            },
          ],
          color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
        });
        colorIndex++;

        // Then: one slide per child (parent + child)
        for (const child of children) {
          slides.push({
            items: [
              {
                text: parentText,
                is_sub_item: false,
              },
              {
                text: child,
                is_sub_item: true,
              },
            ],
            color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
          });
          colorIndex++;
        }
      }

      i = j; // Move past all processed lines
    }
  }

  return slides;
}

/**
 * Calculate slide boundaries with line numbers for visual indicators
 * Returns an array of { startLine, endLine, color } for each slide
 */
export interface SlideBoundary {
  startLine: number;
  endLine: number;
  color: string;
  slideIndex: number;
}

export function calculateSlideBoundaries(text: string): SlideBoundary[] {
  const boundaries: SlideBoundary[] = [];
  const lines = text.split("\n");

  let colorIndex = 0;
  let slideIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      // Empty line - skip
      i++;
      continue;
    }

    if (line.startsWith("\t") || line.startsWith("    ")) {
      // Orphaned indented line - single line slide
      boundaries.push({
        startLine: i,
        endLine: i,
        color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
        slideIndex: slideIndex,
      });
      colorIndex++;
      slideIndex++;
      i++;
    } else {
      // Regular line - this is a parent
      // Collect all immediately following indented lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine.trim() === "") {
          break; // Empty line stops the group
        }
        if (nextLine.startsWith("\t") || nextLine.startsWith("    ")) {
          j++;
        } else {
          break; // Non-indented line stops the group
        }
      }

      const lastChildLine = j - 1;
      const hasChildren = lastChildLine >= i + 1;

      if (!hasChildren) {
        // No children - single slide with just parent
        boundaries.push({
          startLine: i,
          endLine: i,
          color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
          slideIndex: slideIndex,
        });
        colorIndex++;
        slideIndex++;
      } else {
        // Has children - parent-only slide first
        boundaries.push({
          startLine: i,
          endLine: i,
          color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
          slideIndex: slideIndex,
        });
        colorIndex++;
        slideIndex++;

        // Then one slide per child (each spans parent + that child line)
        for (let childIdx = i + 1; childIdx <= lastChildLine; childIdx++) {
          boundaries.push({
            startLine: i, // Start at parent
            endLine: childIdx, // End at this child
            color: SLIDE_COLORS[colorIndex % SLIDE_COLORS.length],
            slideIndex: slideIndex,
          });
          colorIndex++;
          slideIndex++;
        }
      }

      i = j; // Move past all processed lines
    }
  }

  return boundaries;
}

/**
 * Get the color for a specific line number based on which slide it belongs to
 */
export function getLineColor(
  lineNumber: number,
  boundaries: SlideBoundary[]
): string | null {
  for (const boundary of boundaries) {
    if (lineNumber >= boundary.startLine && lineNumber <= boundary.endLine) {
      return boundary.color;
    }
  }
  return null;
}

/**
 * Format slides as text for display or export
 */
export function formatSlidesAsText(slides: LiveSlide[]): string {
  return slides
    .map((slide) =>
      slide.items
        .map((item) => (item.is_sub_item ? `\t${item.text}` : item.text))
        .join("\n")
    )
    .join("\n\n");
}
