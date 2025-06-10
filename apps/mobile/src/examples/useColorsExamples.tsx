// useColors Hook - Usage Examples and Documentation

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "~/hooks/useColors";

/**
 * The useColors hook simplifies theme-based color selection by providing:
 * 
 * 1. Direct access to theme-aware colors (no more theme.isDark ? dark : light)
 * 2. A helper function for custom theme selection
 * 3. Access to the full colors object and theme state
 */

// Example 1: Basic usage - replacing the old pattern
export function ExampleComponent1() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        Welcome to the App
      </Text>
      <Text style={[styles.subtitle, { color: colors.inactive }]}>
        This text adapts to the current theme
      </Text>
    </View>
  );
}

// Example 2: Using the select helper for custom logic
export function ExampleComponent2() {
  const colors = useColors();

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          // Using select helper for custom theme-based values
          borderWidth: colors.select(1, 2), // Light: 1px, Dark: 2px
          borderColor: colors.select("#E0E0E0", "#404040"),
        }
      ]}
    >
      <Text style={{ color: colors.onSurface }}>
        {colors.select("☀️ Light Mode", "🌙 Dark Mode")}
      </Text>
    </View>
  );
}

// Example 3: Accessing brand colors and semantic colors
export function ExampleComponent3() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Brand colors remain the same regardless of theme */}
      <View style={[styles.brandColor, { backgroundColor: colors.primary.dark }]}>
        <Text style={{ color: colors.neutral.white }}>Primary Brand Color</Text>
      </View>
      
      <View style={[styles.brandColor, { backgroundColor: colors.primary.bright }]}>
        <Text style={{ color: colors.neutral.black }}>Secondary Brand Color</Text>
      </View>

      {/* Semantic colors for status/feedback */}
      <Text style={{ color: colors.semantic.success }}>Success Message</Text>
      <Text style={{ color: colors.semantic.warning }}>Warning Message</Text>
      <Text style={{ color: colors.semantic.error }}>Error Message</Text>
    </View>
  );
}

// Example 4: Accessing full theme state when needed
export function ExampleComponent4() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.onSurface }}>
        Current theme: {colors.isDark ? "Dark" : "Light"}
      </Text>
      
      {/* Access to the full colors object for edge cases */}
      <Text style={{ color: colors.colors.neutral.gray500 }}>
        Direct access to gray500: {colors.colors.neutral.gray500}
      </Text>
    </View>
  );
}

/**
 * MIGRATION GUIDE: 
 * 
 * OLD PATTERN:
 * ```tsx
 * const theme = useTheme();
 * 
 * <View style={{
 *   backgroundColor: theme.isDark 
 *     ? colors.dark.background 
 *     : colors.light.background
 * }}>
 *   <Text style={{
 *     color: theme.isDark 
 *       ? colors.dark.onSurface 
 *       : colors.light.onSurface
 *   }}>
 *     Hello World
 *   </Text>
 * </View>
 * ```
 * 
 * NEW PATTERN:
 * ```tsx
 * const colors = useColors();
 * 
 * <View style={{
 *   backgroundColor: colors.background
 * }}>
 *   <Text style={{
 *     color: colors.onSurface
 *   }}>
 *     Hello World
 *   </Text>
 * </View>
 * ```
 * 
 * AVAILABLE THEME-AWARE COLORS:
 * - colors.background
 * - colors.surface
 * - colors.card
 * - colors.onSurface
 * - colors.onBackground
 * - colors.onPrimary
 * - colors.onSecondary
 * - colors.inactive
 * - colors.border
 * - colors.divider
 * - colors.statusBar
 * 
 * AVAILABLE STATIC COLORS (don't change with theme):
 * - colors.primary.dark
 * - colors.primary.bright
 * - colors.secondary.blue
 * - colors.secondary.blueLight
 * - colors.secondary.yellow
 * - colors.secondary.yellowLight
 * - colors.neutral.* (white, black, gray50-900)
 * - colors.semantic.* (success, warning, error, info)
 * 
 * HELPER FUNCTIONS:
 * - colors.select(lightValue, darkValue) - Custom theme-based selection
 * - colors.isDark - Boolean indicating current theme
 * - colors.theme - Full theme object
 * - colors.colors - Full colors object
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  brandColor: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
});
