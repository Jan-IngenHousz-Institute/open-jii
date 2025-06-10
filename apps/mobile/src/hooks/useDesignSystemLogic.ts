import { useState } from "react";

import { useTheme } from "./useTheme";

export interface ColorSwatch {
  name: string;
  color: string;
  textColor: string;
}

export interface ButtonDemo {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isDisabled?: boolean;
  icon?: React.ReactNode;
}

export interface InputDemo {
  label: string;
  placeholder: string;
  helper?: string;
  error?: string;
  value?: string;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
}

export function useDesignSystemLogic() {
  const theme = useTheme();
  const { colors } = theme;

  // Generate color swatches from theme
  const getColorSwatches = (): ColorSwatch[] => {
    return [
      {
        name: "Primary Dark",
        color: colors.primary.dark,
        textColor: "#fff",
      },
      {
        name: "Primary Bright",
        color: colors.primary.bright,
        textColor: "#000",
      },
      {
        name: "Secondary Blue",
        color: colors.secondary.blue,
        textColor: "#000",
      },
      {
        name: "Secondary Blue Light",
        color: colors.secondary.blueLight,
        textColor: "#000",
      },
      {
        name: "Secondary Yellow",
        color: colors.secondary.yellow,
        textColor: "#000",
      },
      {
        name: "Secondary Yellow Light",
        color: colors.secondary.yellowLight,
        textColor: "#000",
      },
    ];
  };

  // Button demonstrations
  const getButtonDemos = (): ButtonDemo[] => {
    return [
      { title: "Primary", variant: "primary" },
      { title: "Secondary", variant: "secondary" },
      { title: "Outline", variant: "outline" },
      { title: "Ghost", variant: "ghost" },
      { title: "Small", size: "sm" },
      { title: "Medium", size: "md" },
      { title: "Large", size: "lg" },
      { title: "Loading", isLoading: true },
      { title: "Disabled", isDisabled: true },
    ];
  };

  // Input field demonstrations
  const getInputDemos = (): InputDemo[] => {
    return [
      {
        label: "Standard Input",
        placeholder: "Enter text here",
      },
      {
        label: "With Helper Text",
        placeholder: "Enter text here",
        helper: "This is helper text that provides additional guidance.",
      },
      {
        label: "With Error",
        placeholder: "Enter text here",
        error: "This field is required",
        value: "Invalid input",
      },
      {
        label: "With Icon",
        placeholder: "Enter your email",
      },
      {
        label: "Password Input",
        placeholder: "Enter your password",
        isPassword: true,
      },
    ];
  };

  // Typography demonstrations
  const getTypographyDemos = () => {
    return [
      { variant: "h1", text: "This is a heading 1" },
      { variant: "h2", text: "This is a heading 2" },
      { variant: "h3", text: "This is a heading 3" },
      { variant: "h4", text: "This is a heading 4" },
      { variant: "h5", text: "This is a heading 5" },
      { variant: "body", text: "This is body text used for most content" },
      { variant: "bodyMedium", text: "This is medium body text" },
      { variant: "lead", text: "This is lead text for introductions" },
      { variant: "subheader", text: "This is a subheader (Regular)" },
      { variant: "subheaderSemiBold", text: "This is a subheader (Semi Bold)" },
      { variant: "subheaderBold", text: "This is a subheader (Bold)" },
      {
        variant: "subheaderExtraBold",
        text: "This is a subheader (Extra Bold)",
      },
      { variant: "subheaderBlack", text: "This is a subheader (Black)" },
      {
        variant: "caption",
        text: "This is caption text used for supplementary information",
      },
      { variant: "overline", text: "This is overline text" },
    ];
  };

  // Card demonstrations
  const getCardDemos = () => {
    return [
      {
        variant: "default",
        title: "Default Card",
        content:
          "This is a default card that can be used to group related content.",
      },
      {
        variant: "elevated",
        title: "Elevated Card",
        content: "This card has elevation to create a sense of hierarchy.",
      },
      {
        variant: "outlined",
        title: "Outlined Card",
        content: "This card has an outline instead of a background color.",
      },
    ];
  };

  return {
    theme,
    colors,
    getColorSwatches,
    getButtonDemos,
    getInputDemos,
    getTypographyDemos,
    getCardDemos,
  };
}
