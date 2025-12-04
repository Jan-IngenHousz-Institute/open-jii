import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { calculateGridLayout } from "~/screens/measurement-flow-screen/components/flow-nodes/question-types/utils/grid-layout";

import { FlowNode } from "../../../types";

interface MultipleChoiceQuestionProps {
  node: FlowNode;
  selectedValue: string;
  onSelect: (value: string) => void;
  disabledOptions?: string[];
}

const optionContainer = cva("items-center justify-center rounded-lg border-2", {
  variants: {
    state: {
      selected: "border-green-500 bg-green-50",
      disabled: "border-gray-200 bg-gray-100",
      default: "border-gray-300 bg-white",
    },
  },
});

const optionText = cva("px-2 text-center font-medium", {
  variants: {
    state: {
      selected: "text-green-600 dark:text-green-400",
      disabled: "text-gray-400 dark:text-gray-500",
      default: "",
    },
  },
});

export function MultipleChoiceQuestion({
  node,
  selectedValue,
  onSelect,
  disabledOptions = [],
}: MultipleChoiceQuestionProps) {
  const { classes } = useTheme();
  const content = node.content;

  const handleOptionSelect = (value: string) => {
    if (disabledOptions.includes(value)) return; // Don't allow selection of disabled options
    const newValue = selectedValue === value ? "" : value;
    onSelect(newValue);
  };

  const numOptions = content.options?.length ?? 0;
  const { buttonHeight, buttonWidth } = calculateGridLayout(numOptions);

  return (
    <View className="flex-1">
      <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
        {content.options?.map((option, index) => {
          const isSelected = selectedValue === option;
          const isDisabled = disabledOptions.includes(option);

          const state = isSelected ? "selected" : isDisabled ? "disabled" : "default";
          return (
            <TouchableOpacity
              key={index}
              className={optionContainer({ state })}
              style={{
                width: buttonWidth,
                height: buttonHeight,
              }}
              onPress={() => handleOptionSelect(option)}
              disabled={isDisabled}
              activeOpacity={isDisabled ? 1 : 0.7}
            >
              <Text
                className={clsx(optionText({ state }), state === "default" && classes.text)}
                numberOfLines={2}
                style={{ fontSize: numOptions <= 2 ? 16 : numOptions <= 4 ? 14 : 12 }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {disabledOptions.length > 0 && (
        <Text className={clsx("mt-3 text-center text-xs", classes.textMuted)}>
          Previously used options are disabled
        </Text>
      )}
    </View>
  );
}
