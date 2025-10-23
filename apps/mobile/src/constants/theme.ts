// JII Design System - Theme Configuration
import { colors } from "./colors";
import { spacing, layout } from "./spacing";
import { typography } from "./typography";

// Theme interface
export interface Theme {
  colors: typeof colors & {
    background: string;
    surface: string;
    card: string;
    border: string;
    onBackground: string;
    onSurface: string;
    onPrimary: string;
    onSecondary: string;
    inactive: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  layout: typeof layout;
  isDark: boolean;
  classes: {
    // Backgrounds
    background: string;
    surface: string;
    card: string;

    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;

    // Borders
    border: string;

    // Interactive elements
    button: string;
    buttonText: string;

    // Input fields
    input: string;
  };
}

// Create the dark theme
export const darkTheme: Theme = {
  colors: {
    ...colors,
    ...colors.dark,
  },
  typography,
  spacing,
  layout,
  isDark: true,
  classes: {
    // Backgrounds
    background: "bg-gray-900",
    surface: "bg-gray-800",
    card: "bg-gray-700",

    // Text colors
    text: "text-white",
    textSecondary: "text-gray-300",
    textMuted: "text-gray-400",

    // Borders
    border: "border-gray-600",

    // Interactive elements
    button: "bg-blue-600",
    buttonText: "text-white",

    // Input fields
    input: "bg-gray-700 border-gray-600 text-white",
  },
};

// Create the light theme
export const lightTheme: Theme = {
  colors: {
    ...colors,
    ...colors.light,
  },
  typography,
  spacing,
  layout,
  isDark: false,
  classes: {
    // Backgrounds
    background: "bg-white",
    surface: "bg-gray-50",
    card: "bg-white",

    // Text colors
    text: "text-gray-900",
    textSecondary: "text-gray-600",
    textMuted: "text-gray-500",

    // Borders
    border: "border-gray-200",

    // Interactive elements
    button: "bg-blue-500",
    buttonText: "text-white",

    // Input fields
    input: "bg-white border-gray-300 text-gray-900",
  },
};

// Default theme
export const defaultTheme = lightTheme;
