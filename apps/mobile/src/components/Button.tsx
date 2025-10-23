import { cva } from "class-variance-authority";
import React from "react";
import {
  TouchableOpacity,
  Text,
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

// CVA variants for button styling
const buttonVariants = cva("rounded-lg items-center justify-center", {
  variants: {
    variant: {
      primary: "bg-[#005e5e]",
      secondary: "bg-[#afd7f4]",
      outline: "bg-transparent border border-[#005e5e]",
      ghost: "bg-transparent",
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
      class: "bg-gray-400",
    },
    {
      variant: "secondary",
      disabled: true,
      class: "bg-gray-400",
    },
    {
      variant: "outline",
      disabled: true,
      class: "border-gray-400",
    },
  ],
});

const textVariants = cva("font-semibold text-center", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-black",
      outline: "text-[#005e5e]",
      ghost: "text-[#005e5e]",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
    disabled: {
      true: "text-gray-400",
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
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const getLoadingColor = () => {
    if (variant === "primary") {
      return colors.onPrimary;
    }
    return colors.primary.dark;
  };

  return (
    <TouchableOpacity
      className={buttonVariants({ variant, size, disabled: isDisabled })}
      style={style}
      disabled={isDisabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={getLoadingColor()} />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={textVariants({ variant, size, disabled: isDisabled })} style={textStyle}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
