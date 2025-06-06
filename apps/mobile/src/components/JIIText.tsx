import React from "react";
import { Text as RNText, TextProps } from "react-native";
import { useTheme } from "~/hooks/useTheme";

interface JIITextProps extends TextProps {
  variant?:
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "lead"
    | "quote"
    | "bodyLarge"
    | "body"
    | "bodyMedium"
    | "bodySmall"
    | "subheaderLarge"
    | "subheader"
    | "subheaderExtraBold"
    | "subheaderBlack"
    | "button"
    | "caption"
    | "overline";
  color?: string;
}

export function JIIText({
  variant = "body",
  color,
  style,
  children,
  ...props
}: JIITextProps) {
  const theme = useTheme();
  const { typography, colors } = theme;

  // Get the default text color based on theme
  const defaultColor = theme.isDark
    ? colors.dark.onSurface
    : colors.light.onSurface;

  // Get the typography style for the variant
  const variantStyle = typography[variant];

  return (
    <RNText
      style={[variantStyle, { color: color ?? defaultColor }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}
