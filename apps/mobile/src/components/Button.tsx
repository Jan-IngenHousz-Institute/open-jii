import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  View,
} from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isDisabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  isLoading = false,
  isDisabled = false,
  style,
  textStyle,
  icon,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const { colors } = theme;

  const getBackgroundColor = () => {
    if (isDisabled) return theme.isDark ? colors.dark.inactive : colors.light.inactive;

    switch (variant) {
      case "primary":
        return colors.primary.dark;
      case "secondary":
        return colors.secondary.blue;
      case "outline":
      case "ghost":
        return "transparent";
      default:
        return colors.primary.dark;
    }
  };

  const getBorderColor = () => {
    if (isDisabled) return theme.isDark ? colors.dark.inactive : colors.light.inactive;

    switch (variant) {
      case "outline":
        return colors.primary.dark;
      default:
        return "transparent";
    }
  };

  const getTextColor = () => {
    if (isDisabled)
      return theme.isDark ? colors.dark.onSurface + "80" : colors.light.onSurface + "80";

    switch (variant) {
      case "primary":
        return theme.isDark ? colors.dark.onPrimary : colors.light.onPrimary;
      case "secondary":
        return theme.isDark ? colors.dark.onSecondary : colors.light.onSecondary;
      case "outline":
      case "ghost":
        return colors.primary.dark;
      default:
        return theme.isDark ? colors.dark.onPrimary : colors.light.onPrimary;
    }
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
        return { paddingVertical: 6, paddingHorizontal: 12 };
      case "lg":
        return { paddingVertical: 14, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 10, paddingHorizontal: 16 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return 14;
      case "lg":
        return 18;
      default:
        return 16;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        { borderColor: getBorderColor() },
        variant === "outline" && styles.outline,
        getPadding(),
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "primary"
              ? theme.isDark
                ? colors.dark.onPrimary
                : colors.light.onPrimary
              : colors.primary.dark
          }
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[styles.text, { color: getTextColor(), fontSize: getFontSize() }, textStyle]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  outline: {
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontWeight: "600",
    textAlign: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
});
