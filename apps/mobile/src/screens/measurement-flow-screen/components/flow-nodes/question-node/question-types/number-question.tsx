import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../../types";

interface NumberQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function NumberQuestion({ content, value, onChange }: NumberQuestionProps) {
  const theme = useTheme();
  const { classes, colors } = theme;

  const handleTextChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.-]/g, "");
    onChange(numericValue);
  };

  const handleClear = () => {
    onChange("");
  };

  const hasValue = value && value.length > 0;

  return (
    <View>
      <View
        className={clsx(
          "flex-row items-center gap-1 rounded-lg border pl-3 pr-2",
          classes.border,
          classes.input,
        )}
      >
        <TextInput
          className="flex-1 text-base"
          placeholder={content.placeholder ?? "Enter a number..."}
          placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
          style={{ color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface }}
          value={value}
          onChangeText={handleTextChange}
          keyboardType="numeric"
        />

        {/* Right button */}
        {hasValue && (
          <TouchableOpacity
            className="rounded-md p-1"
            style={{
              backgroundColor: theme.isDark
                ? colors.dark.grayBackground
                : colors.light.grayBackground,
            }}
            onPress={handleClear}
          >
            <X size={20} color={colors.neutral.black} />
          </TouchableOpacity>
        )}
      </View>

      <View className="mt-2">
        {content.min !== undefined && content.max !== undefined && (
          <Text className={clsx("text-sm", classes.textMuted)}>
            Range: {content.min} - {content.max}
          </Text>
        )}
        {content.min !== undefined && content.max === undefined && (
          <Text className={clsx("text-sm", classes.textMuted)}>Minimum: {content.min}</Text>
        )}
        {content.max !== undefined && content.min === undefined && (
          <Text className={clsx("text-sm", classes.textMuted)}>Maximum: {content.max}</Text>
        )}
        {content.required && isNaN(parseFloat(value)) && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>This field is required</Text>
        )}
      </View>
    </View>
  );
}
