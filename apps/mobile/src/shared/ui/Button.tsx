import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextProps,
  TouchableOpacityProps,
  View,
} from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface ButtonProps extends TouchableOpacityProps {
  title?: string;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "surface"
    | "light"
    | "tertiary"
    | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isDisabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  // Let the label wrap and fill the button width instead of sizing to content.
  multiline?: boolean;
  numberOfLines?: number;
  ellipsizeMode?: TextProps["ellipsizeMode"];
}

const buttonVariants = cva("rounded-lg items-center justify-center", {
  variants: {
    variant: {
      primary: "bg-primary",
      secondary: "bg-jii-secondary-blue dark:bg-jii-secondary-blue/30",
      outline: "bg-transparent border border-primary",
      ghost: "bg-transparent",
      surface: "bg-surface",
      light: "bg-muted",
      tertiary: "bg-primary/10 border border-primary",
      danger: "bg-error/10 border border-error",
    },
    size: {
      sm: "py-1.5 px-3",
      md: "py-2.5 px-4",
      lg: "py-3.5 px-6",
    },
    disabled: {
      true: "opacity-60",
      false: "",
    },
  },
  compoundVariants: [
    {
      variant: "primary",
      disabled: true,
      class: "bg-inactive",
    },
    {
      variant: "secondary",
      disabled: true,
      class: "bg-inactive",
    },
    {
      variant: "outline",
      disabled: true,
      class: "border-inactive",
    },
  ],
});

const textVariants = cva("font-semibold text-center", {
  variants: {
    variant: {
      primary: "text-primary-foreground",
      secondary: "text-foreground",
      outline: "text-primary",
      ghost: "text-primary",
      surface: "text-on-surface",
      light: "text-foreground",
      tertiary: "text-primary",
      danger: "text-error",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
    disabled: {
      true: "text-inactive",
      false: "",
    },
  },
});

export function Button({
  title,
  variant = "primary",
  size = "md",
  isLoading = false,
  isDisabled = false,
  style,
  textStyle,
  icon,
  iconPosition = "left",
  multiline = false,
  numberOfLines,
  ellipsizeMode,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const getLoadingColor = () => {
    if (variant === "primary") {
      return colors.onPrimary;
    }
    return colors.primary.dark;
  };

  // WORKAROUND: Key with timestamp to force remount on every render
  // This bypasses React Native's native style caching bug in Expo SDK 54
  // The timestamp ensures remount even when props stay the same (which was causing the issue)
  const iconOnly = !!icon && !title;
  const renderId = Date.now();
  return (
    <TouchableOpacity
      key={renderId}
      className={buttonVariants({
        variant,
        size: iconOnly ? undefined : size,
        disabled: isDisabled,
      })}
      style={style}
      disabled={isDisabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={getLoadingColor()} />
      ) : iconOnly ? (
        icon
      ) : (
        <View className={clsx("flex-row items-center justify-center", multiline && "w-full")}>
          {icon && iconPosition === "left" && <View className="mr-1">{icon}</View>}
          <Text
            className={clsx(
              textVariants({ variant, size, disabled: isDisabled }),
              multiline && "shrink",
            )}
            style={textStyle}
            numberOfLines={numberOfLines}
            ellipsizeMode={ellipsizeMode}
          >
            {title}
          </Text>
          {icon && iconPosition === "right" && <View className="ml-1">{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}
