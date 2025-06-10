import { colors } from "~/constants/colors";

import { useTheme } from "./useTheme";

// Hook to get theme-aware colors with convenient access patterns
export function useColors() {
  const theme = useTheme();

  // Theme-aware colors that automatically select light/dark variants
  const themeColors = {
    // Background colors
    background: theme.isDark ? colors.dark.background : colors.light.background,
    surface: theme.isDark ? colors.dark.surface : colors.light.surface,
    card: theme.isDark ? colors.dark.card : colors.light.card,

    // Text colors
    onSurface: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
    onBackground: theme.isDark
      ? colors.dark.onBackground
      : colors.light.onBackground,
    onPrimary: theme.isDark ? colors.dark.onPrimary : colors.light.onPrimary,
    onSecondary: theme.isDark
      ? colors.dark.onSecondary
      : colors.light.onSecondary,
    inactive: theme.isDark ? colors.dark.inactive : colors.light.inactive,

    // Border and divider colors
    border: theme.isDark ? colors.dark.border : colors.light.border,
    divider: theme.isDark ? colors.dark.divider : colors.light.divider,

    // Status bar
    statusBar: theme.isDark ? colors.dark.statusBar : colors.light.statusBar,

    // Static brand colors (don't change with theme)
    primary: colors.primary,
    secondary: colors.secondary,
    neutral: colors.neutral,
    semantic: colors.semantic,
  };

  return {
    // Main theme-aware colors
    ...themeColors,

    // Helper function for custom theme selection
    select: <T>(lightValue: T, darkValue: T): T =>
      theme.isDark ? darkValue : lightValue,

    // Access to the full colors object and theme state
    colors,
    theme,
    isDark: theme.isDark,
  };
}

// Type for the hook return value
export type UseColorsReturn = ReturnType<typeof useColors>;
