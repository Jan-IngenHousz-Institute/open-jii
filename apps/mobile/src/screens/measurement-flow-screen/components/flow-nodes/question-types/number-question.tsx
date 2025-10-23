import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface NumberQuestionProps {
  content: QuestionContent;
}

export function NumberQuestion({ content }: NumberQuestionProps) {
  const { classes } = useTheme();
  const [value, setValue] = useState("");

  const handleTextChange = (text: string) => {
    const numericValue = text.replace(/[^0-9.-]/g, "");
    setValue(numericValue);
  };

  const isValidNumber = () => {
    if (!value) return true;
    const num = parseFloat(value);
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
        {!isValidNumber() && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>
            Please enter a valid number
            {content.min !== undefined && ` (min: ${content.min})`}
            {content.max !== undefined && ` (max: ${content.max})`}
          </Text>
        )}
        {content.required && !value && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>This field is required</Text>
        )}
      </View>
    </View>
  );
}
