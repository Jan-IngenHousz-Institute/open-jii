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

export function JIIButton({
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
  const { colors, layout, typography } = theme;

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
    if (isDisabled) {
      return theme.isDark ? colors.dark.onSurface + "80" : colors.light.onSurface + "80";
    }

    switch (variant) {
      case "primary":
        return colors.neutral.white;
      case "secondary":
        return colors.neutral.black;
      case "outline":
      case "ghost":
        return colors.primary.dark;
      default:
        return colors.neutral.white;
    }
  };

  const getPadding = () => {
    switch (size) {
      case "sm":
        return {
          paddingVertical: layout.radiusSmall,
          paddingHorizontal: layout.radiusMedium,
        };
      case "lg":
        return {
          paddingVertical: layout.radiusMedium,
          paddingHorizontal: layout.radiusLarge,
        };
      default:
        return {
          paddingVertical: layout.radiusSmall * 2,
          paddingHorizontal: layout.radiusMedium * 2,
        };
    }
  };

  const getButtonTextStyle = () => {
    switch (size) {
      case "sm":
        return typography.bodySmall;
      case "lg":
        return typography.subheaderLarge;
      default:
        return typography.button;
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
        { borderRadius: layout.radiusMedium },
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
          color={variant === "primary" ? colors.neutral.white : colors.primary.dark}
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[getButtonTextStyle(), { color: getTextColor() }, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
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
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
});
