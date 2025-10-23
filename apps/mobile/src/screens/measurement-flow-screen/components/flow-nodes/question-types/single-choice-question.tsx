import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface SingleChoiceQuestionProps {
  content: QuestionContent;
}

export function SingleChoiceQuestion({ content }: SingleChoiceQuestionProps) {
  const { classes } = useTheme();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const handleOptionSelect = (value: string) => {
    setSelectedValue(value);
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
              selectedValue === option
                ? clsx("border-blue-500 bg-blue-50 dark:bg-blue-900/20", classes.card)
                : classes.card,
            )}
            onPress={() => handleOptionSelect(option)}
            activeOpacity={0.7}
          >
            <View
              className={clsx(
                "mr-3 h-5 w-5 items-center justify-center rounded-full border-2",
                selectedValue === option
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 dark:border-gray-600",
              )}
            >
              {selectedValue === option && <View className="h-2 w-2 rounded-full bg-white" />}
            </View>
            <Text
              className={clsx(
                "flex-1 text-base",
                selectedValue === option ? classes.text : classes.textSecondary,
              )}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {content.required && !selectedValue && (
        <Text className={clsx("mt-2 text-sm text-red-500", classes.text)}>
          Please select an option
        </Text>
      )}
    </View>
  );
}
