import { clsx } from "clsx";
import React from "react";
import { View, Text, TextInput } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface NumberQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function NumberQuestion({ content, value, onChange }: NumberQuestionProps) {
  const { classes } = useTheme();

  const handleTextChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.-]/g, "");
    onChange(numericValue);
  };

  return (
    <View>
      <TextInput
        className={clsx("rounded-lg border p-3 text-base", classes.input, classes.border)}
        placeholder={content.placeholder ?? "Enter a number..."}
        value={value}
        onChangeText={handleTextChange}
        keyboardType="numeric"
      />

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
