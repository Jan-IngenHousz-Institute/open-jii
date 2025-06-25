import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "outlined";
}

export function JIICard({ children, style, variant = "default" }: CardProps) {
  const theme = useTheme();
  const { colors, layout } = theme;

  const getCardStyle = () => {
    const baseStyle = {
      backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
      borderRadius: layout.radiusMedium,
      padding: theme.spacing["4"],
    };

    switch (variant) {
      case "elevated":
        return {
          ...baseStyle,
          ...layout.shadowMedium,
        };
      case "outlined":
        return {
          ...baseStyle,
          backgroundColor: "transparent",
          borderWidth: layout.borderWidthThin,
          borderColor: theme.isDark ? colors.dark.border : colors.light.border,
        };
      default:
        return baseStyle;
    }
  };

  return <View style={[getCardStyle(), styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
  },
});
