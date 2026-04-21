import { Dimensions } from "react-native";

export interface GridLayoutConfig {
  columns: number;
  buttonHeight: number;
  buttonWidth: number;
}

export function calculateGridLayout(numOptions: number): GridLayoutConfig {
  const screenWidth = Dimensions.get("window").width;
  const availableWidth = screenWidth - 32; // Account for padding

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
    columns,
    buttonHeight,
    buttonWidth,
  };
}
