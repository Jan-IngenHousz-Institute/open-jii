import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface MultipleChoiceQuestionProps {
  content: QuestionContent;
}

export function MultipleChoiceQuestion({ content }: MultipleChoiceQuestionProps) {
  const { classes } = useTheme();
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  const handleOptionToggle = (value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <View>
      <View className="space-y-2">
        {content.options?.map((option, index) => (
          <TouchableOpacity
            key={index}
            className={clsx(
              "flex-row items-center rounded-lg border p-3",
              classes.border,
              selectedValues.includes(option)
                ? clsx("border-blue-500 bg-blue-50 dark:bg-blue-900/20", classes.card)
                : classes.card,
            )}
            onPress={() => handleOptionToggle(option)}
            activeOpacity={0.7}
          >
            <View
              className={clsx(
                "mr-3 h-5 w-5 items-center justify-center rounded border-2",
                selectedValues.includes(option)
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 dark:border-gray-600",
              )}
            >
              {selectedValues.includes(option) && (
                <Text className="text-xs font-bold text-white">✓</Text>
              )}
            </View>
            <Text
              className={clsx(
                "flex-1 text-base",
                selectedValues.includes(option) ? classes.text : classes.textSecondary,
              )}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mt-2">
        {selectedValues.length > 0 && (
          <Text className={clsx("text-sm", classes.textMuted)}>
            Selected: {selectedValues.length} option{selectedValues.length !== 1 ? "s" : ""}
          </Text>
        )}
        {content.required && selectedValues.length === 0 && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>
            Please select at least one option
          </Text>
        )}
      </View>
    </View>
  );
}
