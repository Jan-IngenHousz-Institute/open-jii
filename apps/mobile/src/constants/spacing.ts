// JII Design System - Spacing Tokens

// Base spacing values
export const spacing = {
  // Base spacing unit (4px)
  "0": 0,
  "0.5": 2,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
  "20": 80,
  "24": 96,
  "32": 128,
};

// Layout constants
export const layout = {
  // Screen padding
  screenPaddingHorizontal: spacing["4"],
  screenPaddingVertical: spacing["4"],

  // Content width constraints
  contentMaxWidth: 1200,
  contentNarrowMaxWidth: 768,

  // Component spacing
  componentGap: spacing["4"],
  sectionGap: spacing["8"],

  // Border radius
  radiusSmall: 4,
  radiusMedium: 8,
  radiusLarge: 12,
  radiusXL: 16,
  radiusRound: 9999,

  // Border width
  borderWidthThin: 1,
  borderWidthMedium: 2,
  borderWidthThick: 4,

  // Shadows
  shadowSmall: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shadowMedium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  shadowLarge: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};
