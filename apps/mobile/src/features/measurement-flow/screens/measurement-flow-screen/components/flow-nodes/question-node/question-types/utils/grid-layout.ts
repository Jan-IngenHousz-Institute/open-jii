import { Dimensions } from "react-native";

export interface GridLayoutConfig {
  layout: "grid" | "list";
  columns: number;
  buttonHeight: number;
  buttonWidth: number;
}

// Longest option (in characters) that still fits a compact grid cell. Anything
// longer switches to a full-width, wrapping list so the text stays readable.
export const GRID_CHAR_THRESHOLD = 16;

export function calculateGridLayout(options: string[]): GridLayoutConfig {
  const screenWidth = Dimensions.get("window").width;
  const availableWidth = screenWidth - 32; // Account for padding
  const numOptions = options.length;
  const longestOption = options.reduce((max, option) => Math.max(max, option.length), 0);

  // Long answers can't fit a fixed grid cell; render them as a full-width list
  // where each row grows to fit its wrapped text.
  if (longestOption > GRID_CHAR_THRESHOLD) {
    return {
      layout: "list",
      columns: 1,
      buttonHeight: 48, // minimum; rows grow to fit wrapped text
      buttonWidth: availableWidth,
    };
  }

  // Determine grid columns and button size based on number of options
  let columns = 1;
  let buttonHeight = 48;

  if (numOptions <= 2) {
    columns = 2;
    buttonHeight = 60; // Bigger buttons for fewer options
  } else if (numOptions <= 4) {
    columns = 2;
    buttonHeight = 50;
  } else if (numOptions <= 6) {
    columns = 3;
    buttonHeight = 45;
  } else {
    columns = 3;
    buttonHeight = 40; // Smaller buttons for many options
  }

  const buttonWidth = (availableWidth - (columns - 1) * 8) / columns; // 8px gap between buttons

  return {
    layout: "grid",
    columns,
    buttonHeight,
    buttonWidth,
  };
}
