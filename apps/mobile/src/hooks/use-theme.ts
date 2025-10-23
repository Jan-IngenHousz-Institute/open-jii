import { useContext } from "react";
import { Theme, defaultTheme } from "~/constants/theme";
import { ThemeContext } from "~/context/ThemeContext";

// Extended theme interface with NativeWind classes
export interface ThemeWithClasses extends Theme {
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

// Hook to access the current theme with NativeWind classes
export function useTheme(): ThemeWithClasses {
  const theme = useContext(ThemeContext);
  const currentTheme = theme || defaultTheme;

  // Generate NativeWind classes based on theme
  const classes = {
    // Backgrounds
    background: currentTheme.isDark ? "bg-gray-900" : "bg-white",
    surface: currentTheme.isDark ? "bg-gray-800" : "bg-gray-50",
    card: currentTheme.isDark ? "bg-gray-700" : "bg-white",

    // Text colors
    text: currentTheme.isDark ? "text-white" : "text-gray-900",
    textSecondary: currentTheme.isDark ? "text-gray-300" : "text-gray-600",
    textMuted: currentTheme.isDark ? "text-gray-400" : "text-gray-500",

    // Borders
    border: currentTheme.isDark ? "border-gray-600" : "border-gray-200",

    // Interactive elements
    button: currentTheme.isDark ? "bg-blue-600" : "bg-blue-500",
    buttonText: "text-white",

    // Input fields
    input: currentTheme.isDark
      ? "bg-gray-700 border-gray-600 text-white"
      : "bg-white border-gray-300 text-gray-900",
  };

  return {
    ...currentTheme,
    classes,
  };
}
