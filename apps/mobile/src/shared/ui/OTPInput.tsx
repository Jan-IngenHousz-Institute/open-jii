import React, { useRef, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { View, TextInput, Pressable } from "react-native";

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
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  const digits = value.split("").slice(0, length);
  while (digits.length < length) {
    digits.push("");
  }

  const handleChange = (text: string, index: number) => {
    const sanitized = text.replace(/[^0-9]/g, "");

    if (text.length > 0 && sanitized.length === 0) {
      return;
    }

    if (sanitized.length === 0) {
      const newValue = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChangeText(newValue);

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (sanitized.length > 1) {
      const pastedDigits = sanitized.split("").slice(0, length);
      const newDigits = [...digits];

      pastedDigits.forEach((digit, i) => {
        if (index + i < length) {
          newDigits[index + i] = digit;
        }
      });

      onChangeText(newDigits.join(""));

      const nextEmptyIndex = newDigits.findIndex((d, i) => i > index && d === "");
      const targetIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : length - 1;
      inputRefs.current[targetIndex]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = sanitized[0];
    onChangeText(newDigits.join(""));

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

  return (
    <View className="flex-row justify-center gap-2">
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        const boxBorder = error
          ? "border-2 border-destructive"
          : isFocused
            ? "border-2 border-primary"
            : "border border-border";
        return (
          <Pressable key={index} onPress={() => handleBoxPress(index)}>
            <View
              className={`bg-surface h-14 w-12 items-center justify-center rounded-lg ${boxBorder}`}
            >
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                // textAlign stays inline: NativeWind 5 crashes when text-center + font-semibold are both classes here.
                className="text-on-surface h-full w-full text-2xl font-semibold"
                style={{ textAlign: "center" }}
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
        );
      })}
    </View>
  );
}
