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
  helper?: string;
}

export function Input({
  label,
  error,
  containerStyle,
  isPassword = false,
  leftIcon,
  helper,
  ...props
}: InputProps) {
  const themeColors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderClass = error ? "border-destructive" : isFocused ? "border-primary" : "border-border";

  return (
    <View className="mb-4" style={containerStyle}>
      {label && <Text className="text-on-surface mb-1.5 text-sm">{label}</Text>}
      <View className={`bg-surface flex-row items-center rounded-lg border ${borderClass}`}>
        {leftIcon && <View className="pl-3">{leftIcon}</View>}
        <TextInput
          className="text-on-surface flex-1 px-3 py-2.5 text-base"
          placeholderTextColor={themeColors.inactive}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2.5">
            {showPassword ? (
              <EyeOff size={20} color={themeColors.onSurface} />
            ) : (
              <Eye size={20} color={themeColors.onSurface} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text className="text-destructive mt-1 text-xs">{error}</Text>
      ) : helper ? (
        <Text className="text-inactive mt-1 text-xs">{helper}</Text>
      ) : null}
    </View>
  );
}
