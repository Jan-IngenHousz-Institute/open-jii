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
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

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
  const theme = useTheme();
  const { colors } = theme;

  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.isDark ? colors.dark.surface : colors.light.surface,
            borderColor: error
              ? colors.semantic.error
              : isFocused
                ? colors.primary.dark
                : theme.isDark
                  ? colors.dark.border
                  : colors.light.border,
          },
          isFocused && styles.focused,
          error && styles.error,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
          placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            {showPassword ? (
              <EyeOff
                size={20}
                color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface}
              />
            ) : (
              <Eye
                size={20}
                color={theme.isDark ? colors.dark.onSurface : colors.light.onSurface}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.semantic.error }]}>{error}</Text>
      ) : helper ? (
        <Text
          style={[
            styles.helperText,
            {
              color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
            },
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
  label: {
    marginBottom: 6,
    fontSize: 14,
  },
  inputContainer: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  focused: {
    borderColor: colors.primary.dark,
  },
  error: {
    borderColor: colors.semantic.error,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  eyeIcon: {
    padding: 10,
  },
  leftIconContainer: {
    paddingLeft: 12,
  },
});
