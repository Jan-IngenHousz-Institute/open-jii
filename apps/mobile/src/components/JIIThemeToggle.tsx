import { Sun, Moon, Smartphone } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useTheme } from "~/hooks/useTheme";

interface ThemeToggleProps {
  style?: any;
}

export function JIIThemeToggle({ style }: ThemeToggleProps) {
  // Access the enhanced theme with changeTheme function
  const theme = useTheme() as any; // Using any to access the enhanced properties
  const { colors, layout, spacing, typography } = theme;

  const handleThemeChange = (newTheme: "system" | "light" | "dark") => {
    if (theme.changeTheme) {
      theme.changeTheme(newTheme);
    }
  };

  const getButtonStyle = (themeType: "system" | "light" | "dark") => {
    const isActive = theme.themePreference === themeType;
    return {
      backgroundColor: isActive ? colors.primary.dark : "transparent",
      borderColor: isActive
        ? colors.primary.dark
        : theme.isDark
          ? colors.dark.border
          : colors.light.border,
    };
  };

  const getTextColor = (themeType: "system" | "light" | "dark") => {
    const isActive = theme.themePreference === themeType;
    return isActive
      ? colors.neutral.white
      : theme.isDark
        ? colors.dark.onSurface
        : colors.light.onSurface;
  };

  const getIconColor = (themeType: "system" | "light" | "dark") => {
    const isActive = theme.themePreference === themeType;
    return isActive
      ? colors.neutral.white
      : theme.isDark
        ? colors.dark.onSurface
        : colors.light.onSurface;
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            borderRadius: layout.radiusMedium,
            borderWidth: layout.borderWidthThin,
          },
          getButtonStyle("system"),
        ]}
        onPress={() => handleThemeChange("system")}
      >
        <Smartphone size={20} color={getIconColor("system")} />
        <Text
          style={[
            typography.bodySmall,
            { color: getTextColor("system"), marginLeft: spacing["2"] },
          ]}
        >
          System
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          {
            borderRadius: layout.radiusMedium,
            borderWidth: layout.borderWidthThin,
          },
          getButtonStyle("light"),
        ]}
        onPress={() => handleThemeChange("light")}
      >
        <Sun size={20} color={getIconColor("light")} />
        <Text
          style={[typography.bodySmall, { color: getTextColor("light"), marginLeft: spacing["2"] }]}
        >
          Light
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.button,
          {
            borderRadius: layout.radiusMedium,
            borderWidth: layout.borderWidthThin,
          },
          getButtonStyle("dark"),
        ]}
        onPress={() => handleThemeChange("dark")}
      >
        <Moon size={20} color={getIconColor("dark")} />
        <Text
          style={[typography.bodySmall, { color: getTextColor("dark"), marginLeft: spacing["2"] }]}
        >
          Dark
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: "center",
  },
});
