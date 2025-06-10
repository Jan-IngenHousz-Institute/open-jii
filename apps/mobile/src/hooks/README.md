# useColors Hook

A simplified React Native hook for theme-aware color management that eliminates the repetitive `theme.isDark ? colors.dark.x : colors.light.x` pattern.

## Overview

The `useColors` hook provides direct access to theme-appropriate colors without manually checking the current theme state. It automatically selects the correct color values based on the current theme (light/dark).

## Basic Usage

### Before (Old Pattern)
```tsx
import { useTheme } from "~/hooks/useTheme";
import { colors } from "~/constants/colors";

function MyComponent() {
  const theme = useTheme();
  
  return (
    <View style={{
      backgroundColor: theme.isDark 
        ? colors.dark.background 
        : colors.light.background
    }}>
      <Text style={{
        color: theme.isDark 
          ? colors.dark.onSurface 
          : colors.light.onSurface
      }}>
        Hello World
      </Text>
    </View>
  );
}
```

### After (New Pattern)
```tsx
import { useColors } from "~/hooks/useColors";

function MyComponent() {
  const colors = useColors();
  
  return (
    <View style={{
      backgroundColor: colors.background
    }}>
      <Text style={{
        color: colors.onSurface
      }}>
        Hello World
      </Text>
    </View>
  );
}
```

## Available Theme-Aware Colors

The hook provides these automatically theme-aware colors:

- `colors.background` - Main background color
- `colors.surface` - Surface/container background
- `colors.card` - Card background color
- `colors.onSurface` - Primary text color on surfaces
- `colors.onBackground` - Primary text color on backgrounds
- `colors.onPrimary` - Text color on primary backgrounds
- `colors.onSecondary` - Text color on secondary backgrounds
- `colors.inactive` - Inactive/disabled text color
- `colors.border` - Border color
- `colors.divider` - Divider line color
- `colors.statusBar` - Status bar color

## Static Brand Colors

These colors remain constant regardless of theme:

- `colors.primary.dark` - Primary brand color (dark)
- `colors.primary.bright` - Primary brand color (bright)
- `colors.secondary.blue` - Secondary blue
- `colors.secondary.blueLight` - Light blue variant
- `colors.secondary.yellow` - Secondary yellow
- `colors.secondary.yellowLight` - Light yellow variant
- `colors.neutral.*` - Neutral color palette
- `colors.semantic.*` - Semantic colors (success, warning, error, info)

## Advanced Usage

### Custom Theme Selection

Use the `select` helper for custom theme-based logic:

```tsx
function MyComponent() {
  const colors = useColors();
  
  return (
    <View style={{
      backgroundColor: colors.background,
      // Custom theme-based values
      borderWidth: colors.select(1, 2), // Light: 1px, Dark: 2px
      borderColor: colors.select("#E0E0E0", "#404040"),
    }}>
      <Text style={{ color: colors.onSurface }}>
        {colors.select("☀️ Light Mode", "🌙 Dark Mode")}
      </Text>
    </View>
  );
}
```

### Accessing Full Theme State

When you need access to the complete theme object:

```tsx
function MyComponent() {
  const colors = useColors();
  
  return (
    <View>
      <Text style={{ color: colors.onSurface }}>
        Current theme: {colors.isDark ? "Dark" : "Light"}
      </Text>
      
      {/* Direct access to the full colors object */}
      <Text style={{ color: colors.colors.neutral.gray500 }}>
        Using gray500 directly
      </Text>
    </View>
  );
}
```

## API Reference

The `useColors` hook returns an object with:

```tsx
{
  // Theme-aware colors (automatically switch based on theme)
  background: string;
  surface: string;
  card: string;
  onSurface: string;
  onBackground: string;
  onPrimary: string;
  onSecondary: string;
  inactive: string;
  border: string;
  divider: string;
  statusBar: string;
  
  // Static brand colors (remain constant)
  primary: { dark: string; bright: string };
  secondary: { blue: string; blueLight: string; yellow: string; yellowLight: string };
  neutral: { white: string; black: string; gray50: string; /* ... */ };
  semantic: { success: string; warning: string; error: string; info: string };
  
  // Helper functions and state
  select: <T>(lightValue: T, darkValue: T) => T;
  isDark: boolean;
  theme: Theme;
  colors: typeof colors;
}
```

## Migration Guide

To migrate existing components:

1. Replace `useTheme()` import with `useColors()`
2. Replace `theme.isDark ? colors.dark.x : colors.light.x` with `colors.x`
3. Use `colors.select(lightValue, darkValue)` for custom theme logic
4. Access `colors.isDark` instead of `theme.isDark` if needed

## TypeScript Support

The hook is fully typed and exports the `UseColorsReturn` type for advanced usage:

```tsx
import { useColors, type UseColorsReturn } from "~/hooks/useColors";

function useCustomColors(): UseColorsReturn {
  return useColors();
}
```
