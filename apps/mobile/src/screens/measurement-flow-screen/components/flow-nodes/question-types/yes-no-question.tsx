import { clsx } from "clsx";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

export interface YesNoQuestionProps {
  content: QuestionContent;
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function YesNoQuestion({ content, selectedValue, onSelect }: YesNoQuestionProps) {
  const { classes } = useTheme();

  const handleSelect = (value: "Yes" | "No") => {
    onSelect(value);
  };

  return (
    <View className="flex-1 items-center justify-center">
      <View className="flex-row gap-4">
        <TouchableOpacity
          className={clsx(
            "flex-1 items-center justify-center rounded-lg border-2 p-6",
            selectedValue === "Yes"
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : clsx("border-gray-300 dark:border-gray-600", classes.card),
          )}
          onPress={() => handleSelect("Yes")}
          activeOpacity={0.7}
        >
          <Text
            className={clsx(
              "text-xl font-semibold",
              selectedValue === "Yes" ? "text-green-600 dark:text-green-400" : classes.text,
            )}
          >
            Yes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={clsx(
            "flex-1 items-center justify-center rounded-lg border-2 p-6",
            selectedValue === "No"
              ? "border-red-500 bg-red-50 dark:bg-red-900/20"
              : clsx("border-gray-300 dark:border-gray-600", classes.card),
          )}
          onPress={() => handleSelect("No")}
          activeOpacity={0.7}
        >
          <Text
            className={clsx(
              "text-xl font-semibold",
              selectedValue === "No" ? "text-red-600 dark:text-red-400" : classes.text,
            )}
          >
            No
          </Text>
        </TouchableOpacity>
      </View>

      {content.required && !selectedValue && (
        <Text className={clsx("mt-4 text-sm text-red-500", classes.text)}>
          Please select an option
        </Text>
      )}
    </View>
  );
}
