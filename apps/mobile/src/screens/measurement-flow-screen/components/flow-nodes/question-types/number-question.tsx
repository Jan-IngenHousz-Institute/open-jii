import { clsx } from "clsx";
import React, { useState } from "react";
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
  const [internal, setInternal] = useState(value);

  const handleTextChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.-]/g, "");
    setInternal(numericValue);
    onChange(numericValue);
  };

  const isValidNumber = (input: string) => {
    if (!input) return true;
    const num = parseFloat(input);
    if (isNaN(num)) return false;
    if (content.min !== undefined && num < content.min) return false;
    if (content.max !== undefined && num > content.max) return false;
    return true;
  };

  return (
    <View>
      <TextInput
        className={clsx(
          "rounded-lg border p-3 text-base",
          classes.input,
          classes.border,
          !isValidNumber() && "border-red-500",
        )}
        placeholder={content.placeholder ?? "Enter a number..."}
        value={internal}
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
        {!isValidNumber(internal) && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>
            Please enter a valid number
            {content.min !== undefined && ` (min: ${content.min})`}
            {content.max !== undefined && ` (max: ${content.max})`}
          </Text>
        )}
        {content.required && !internal && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>This field is required</Text>
        )}
      </View>
    </View>
  );
}
