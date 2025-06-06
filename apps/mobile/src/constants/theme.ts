// JII Design System - Theme Configuration
import { colors } from "./colors";
import { spacing, layout } from "./spacing";
import { typography } from "./typography";

// Theme interface
export interface Theme {
  colors: typeof colors;
  typography: typeof typography;
  spacing: typeof spacing;
  layout: typeof layout;
  isDark: boolean;
}

// Create the dark theme
export const darkTheme: Theme = {
  colors: colors,
  typography,
  spacing,
  layout,
  isDark: true,
};

// Create the light theme
export const lightTheme: Theme = {
  colors: colors,
  typography,
  spacing,
  layout,
  isDark: false,
};

// Default theme
export const defaultTheme = lightTheme;
