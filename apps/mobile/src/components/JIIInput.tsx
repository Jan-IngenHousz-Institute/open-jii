import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
  leftIcon?: React.ReactNode;
  helper?: string;
}

export function JIIInput({
  label,
  error,
  containerStyle,
  isPassword = false,
  leftIcon,
  helper,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const theme = useTheme();
  const { colors, layout } = theme;

  const inputBgColor = theme.isDark ? colors.dark.surface : colors.light.surface;
  const inputTextColor = theme.isDark ? colors.dark.onSurface : colors.light.onSurface;
  const placeholderColor = theme.isDark ? colors.dark.inactive : colors.light.inactive;
  const borderColor = theme.isDark ? colors.dark.border : colors.light.border;
  const focusedBorderColor = colors.primary.dark;
  const errorColor = colors.semantic.error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            theme.typography.subheader,
            { color: inputTextColor, marginBottom: theme.spacing["1"] },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: inputBgColor,
            borderColor: error ? errorColor : isFocused ? focusedBorderColor : borderColor,
            borderRadius: layout.radiusMedium,
          },
          isFocused && styles.focused,
          error && styles.error,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          style={[theme.typography.body, styles.input, { color: inputTextColor }]}
          placeholderTextColor={placeholderColor}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            {showPassword ? (
              <EyeOff size={20} color={inputTextColor} />
            ) : (
              <Eye size={20} color={inputTextColor} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text
          style={[theme.typography.caption, { color: errorColor, marginTop: theme.spacing["1"] }]}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text
          style={[
            theme.typography.caption,
            { color: placeholderColor, marginTop: theme.spacing["1"] },
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputContainer: {
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  focused: {
    borderWidth: 2,
  },
  error: {
    borderWidth: 2,
  },
  eyeIcon: {
    padding: 10,
  },
  leftIconContainer: {
    paddingLeft: 12,
  },
});
