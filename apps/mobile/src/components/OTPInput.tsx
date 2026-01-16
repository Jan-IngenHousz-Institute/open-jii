import React, { useRef, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface OTPInputProps {
  length?: number;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
  error?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChangeText,
  autoFocus = false,
  editable = true,
  error = false,
}: OTPInputProps) {
  const theme = useTheme();
  const { colors } = theme;
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  const digits = value.split("").slice(0, length);
  while (digits.length < length) {
    digits.push("");
  }

  const handleChange = (text: string, index: number) => {
    // Only allow digits - reject immediately if invalid
    const sanitized = text.replace(/[^0-9]/g, "");

    // If nothing valid, don't process
    if (text.length > 0 && sanitized.length === 0) {
      return;
    }

    if (sanitized.length === 0) {
      // Handle deletion
      const newValue = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChangeText(newValue);

      // Move to previous input
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    // Handle paste of multiple digits
    if (sanitized.length > 1) {
      const pastedDigits = sanitized.split("").slice(0, length);
      const newDigits = [...digits];

      pastedDigits.forEach((digit, i) => {
        if (index + i < length) {
          newDigits[index + i] = digit;
        }
      });

      onChangeText(newDigits.join(""));

      // Focus the next empty input or the last one
      const nextEmptyIndex = newDigits.findIndex((d, i) => i > index && d === "");
      const targetIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : length - 1;
      inputRefs.current[targetIndex]?.focus();
      return;
    }

    // Handle single digit input
    const newDigits = [...digits];
    newDigits[index] = sanitized[0];
    onChangeText(newDigits.join(""));

    // Move to next input
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<{ key: string }>, index: number) => {
    if (e.nativeEvent.key === "Backspace" && digits[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleBoxPress = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const borderColor = theme.isDark ? colors.dark.border : colors.light.border;
  const errorColor = "#dc2626";
  const focusColor = "#005e5e";
  const backgroundColor = theme.isDark ? colors.dark.surface : colors.light.surface;
  const textColor = theme.isDark ? colors.dark.onSurface : colors.light.onSurface;

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => (
        <Pressable key={index} onPress={() => handleBoxPress(index)}>
          <View
            style={[
              styles.box,
              {
                borderColor: error ? errorColor : focusedIndex === index ? focusColor : borderColor,
                backgroundColor,
                borderWidth: focusedIndex === index || error ? 2 : 1,
              },
            ]}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[styles.input, { color: textColor }]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              keyboardType="number-pad"
              maxLength={length}
              selectTextOnFocus
              editable={editable}
              autoFocus={autoFocus && index === 0}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              caretHidden
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    height: "100%",
  },
});
