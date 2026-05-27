import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { View, TextInput, Text, TextInputProps, ViewStyle, TouchableOpacity } from "react-native";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  /** Rendered as absolutely-positioned children inside the input border box.
   *  Use when you need overlays pinned to a corner of the input (e.g. action
   *  buttons inside a multiline textarea). */
  overlay?: React.ReactNode;
  helper?: string;
  /** When true, renders BottomSheetTextInput instead of TextInput so the
   *  keyboard interacts correctly inside a bottom sheet. */
  asBottomSheet?: boolean;
}

export function Input({
  label,
  error,
  containerStyle,
  isPassword = false,
  leftIcon,
  rightElement,
  overlay,
  helper,
  asBottomSheet = false,
  ...props
}: InputProps) {
  const themeColors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderClass = error ? "border-destructive" : isFocused ? "border-primary" : "border-border";
  const TextComponent = (asBottomSheet ? BottomSheetTextInput : TextInput) as typeof TextInput;

  return (
    <View className="mb-4" style={containerStyle}>
      {label && <Text className="text-on-surface mb-1.5 text-sm">{label}</Text>}
      <View
        className={`bg-surface flex-row items-center rounded-lg border ${borderClass}`}
        style={overlay ? { position: "relative" } : undefined}
      >
        {leftIcon && <View className="pl-3">{leftIcon}</View>}
        <TextComponent
          className="text-on-surface flex-1 px-3 py-2.5 text-base"
          placeholderTextColor={themeColors.inactive}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {rightElement}
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2.5">
            {showPassword ? (
              <EyeOff size={20} color={themeColors.onSurface} />
            ) : (
              <Eye size={20} color={themeColors.onSurface} />
            )}
          </TouchableOpacity>
        )}
        {overlay}
      </View>
      {error ? (
        <Text className="text-destructive mt-1 text-xs">{error}</Text>
      ) : helper ? (
        <Text className="text-inactive mt-1 text-xs">{helper}</Text>
      ) : null}
    </View>
  );
}
