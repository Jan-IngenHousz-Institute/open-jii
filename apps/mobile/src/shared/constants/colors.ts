// JII Design System - Color Tokens
export const colors = {
  // Primary Colors
  primary: {
    dark: "#005e5e", // Dark green
    bright: "#49e06d", // Bright green
  },

  // Secondary Colors
  secondary: {
    blue: "#afd7f4", // Light blue
    blueLight: "rgba(175, 215, 244, 0.5)", // Light blue 50%
    yellow: "#fff381", // Light yellow
    yellowLight: "rgba(255, 243, 129, 0.5)", // Light yellow 50%
  },

  // Neutral Colors
  neutral: {
    white: "#FFFFFF",
    black: "#000000",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray300: "#D1D5DB",
    gray400: "#9CA3AF",
    gray500: "#6B7280",
    gray600: "#4B5563",
    gray700: "#374151",
    gray800: "#1F2937",
    gray900: "#111827",
  },

  // Semantic Colors
  semantic: {
    success: "#09b732",
    warning: "#FBBF24",
    error: "#EF4444",
    info: "#3B82F6",
  },

  // Redesign palette (Field Companion home + flow hero + badges)
  jii: {
    darkGreen: "#005e5e",
    darkerGreen: "#002f2f",
    brightGreen: "#49e06d",
    yellow: "#fff481",
    yellowLight: "#fbf8c1",
    mint: "#e2fcfc",
    mintLight: "#edffff",
    mutedBody: "#68737b",
  },

  badge: {
    active: "#ccfcd8",
    stale: "#ffe0b2",
    published: "#d8f2fc",
    featured: "#e2fcfc",
  },

  // Theme Colors (dark theme)
  dark: {
    background: "#121212",
    surface: "#1E1E1E",
    card: "#252525",
    border: "#2C2C2C",
    onBackground: "#FFFFFF",
    onSurface: "#FFFFFF",
    onPrimary: "#000000",
    onSecondary: "#000000",
    inactive: "#757575",
    divider: "#2C2C2C",
    statusBar: "#000000",
    grayBackground: "#1C2128",
    brand: "#49e06d", // primary.bright — interactive accent in dark
    warningFg: "#fde68a", // amber-200 — readable warning text/icon on dark amber-tinted surfaces
  },

  // Theme Colors (light theme)
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F5",
    card: "#FFFFFF",
    border: "#E0E0E0",
    onBackground: "#121212",
    onSurface: "#121212",
    onPrimary: "#FFFFFF",
    onSecondary: "#121212",
    inactive: "#9E9E9E",
    divider: "#E0E0E0",
    statusBar: "#FFFFFF",
    grayBackground: "#F6F8FA", // figma gray light
    brand: "#005e5e", // primary.dark — interactive accent in light
    warningFg: "#92400e", // amber-800 — readable warning text/icon on light amber-tinted surfaces
  },
};
