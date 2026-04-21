import { clsx } from "clsx";
import { Check } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { calculateGridLayout } from "~/screens/measurement-flow-screen/components/flow-nodes/question-node/question-types/utils/grid-layout";

import { FlowNode } from "../../../../types";

interface MultipleChoiceQuestionProps {
  node: FlowNode;
  selectedValue: string;
  onSelect: (value: string) => void;
  disabledOptions?: string[];
  searchTerm?: string;
}

export function MultipleChoiceQuestion({
  node,
  selectedValue,
  onSelect,
  disabledOptions = [],
  searchTerm = "",
}: MultipleChoiceQuestionProps) {
  const { classes } = useTheme();
  const content = node.content;

  // If required, can't deselect by tapping again
  // if not required, tapping again deselects (sets value to empty string)
  // Both cases it auto advances on select to the next step
  const handleOptionSelect = (value: string) => {
    if (disabledOptions.includes(value)) return;

    let newValue = value;

    // Optional questions keep toggle behavior
    if (!content.required && selectedValue === value) {
      newValue = "";
    }

    onSelect(newValue);
  };
  const filteredOptions =
    content.options?.filter((option) => option.toLowerCase().includes(searchTerm.toLowerCase())) ??
    [];

  const numOptions = filteredOptions.length;
  const { buttonHeight, buttonWidth } = calculateGridLayout(numOptions);

  return (
    <View className="flex-1 gap-2">
      {content.required && !selectedValue && (
        <Text className={clsx("text-center text-sm text-red-500")}>
          Selecting an option is required
        </Text>
      )}
      <View className="flex-row flex-wrap justify-center gap-2">
        {filteredOptions.map((option, index) => {
          const isSelected = selectedValue === option;
          const isDisabled = disabledOptions.includes(option);

          return (
            <Button
              key={index}
              title={option}
              variant={isSelected ? "tertiary" : "light"}
              style={{
                width: buttonWidth,
                height: buttonHeight,
              }}
              textStyle={{ fontSize: numOptions <= 2 ? 16 : numOptions <= 4 ? 14 : 12 }}
              onPress={() => handleOptionSelect(option)}
              isDisabled={isDisabled}
              icon={isSelected ? <Check size={16} color="#005E5E" strokeWidth={3} /> : undefined}
              iconPosition="right"
            />
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
