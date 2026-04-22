import { Check, X } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";

import { QuestionContent } from "../../../../types";

export interface YesNoQuestionProps {
  content: QuestionContent;
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function YesNoQuestion({ content, selectedValue, onSelect }: YesNoQuestionProps) {
  // If required, can't deselect by tapping again
  // if not required, tapping again deselects (sets value to empty string)
  // Both cases it auto advances on select to the next step
  const handleSelect = (value: "Yes" | "No" | "") => {
    let newValue = value;

    if (!content.required && selectedValue === value) {
      newValue = "";
    }

    onSelect(newValue);
  };
  return (
    <View className="flex-1 items-start justify-start">
      <View className="flex-row gap-4">
        <Button
          title="Yes"
          variant={selectedValue === "Yes" ? "tertiary" : "light"}
          style={{ flex: 1, minHeight: 70 }}
          textStyle={{ fontSize: 20 }}
          onPress={() => handleSelect("Yes")}
          icon={
            selectedValue === "Yes" ? (
              <Check size={20} color="#005E5E" strokeWidth={3} />
            ) : undefined
          }
          iconPosition="right"
        />

        <Button
          title="No"
          variant={selectedValue === "No" ? "danger" : "light"}
          style={{ flex: 1, minHeight: 70 }}
          textStyle={{ fontSize: 20 }}
          onPress={() => handleSelect("No")}
          icon={
            selectedValue === "No" ? <X size={20} color="#DC2626" strokeWidth={3} /> : undefined
          }
          iconPosition="right"
        />
      </View>

      {content.required && !selectedValue && (
        <Text className="mt-2 text-center text-sm text-red-500">Please select an option</Text>
      )}
    </View>
  );
}
