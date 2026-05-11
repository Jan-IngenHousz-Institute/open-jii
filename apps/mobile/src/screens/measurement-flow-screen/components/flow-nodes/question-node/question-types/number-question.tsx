import { X } from "lucide-react-native";
import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { colors } from "~/constants/colors";
import { useThemeColors } from "~/hooks/use-theme-colors";

import { QuestionContent } from "../../../../types";

interface NumberQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function NumberQuestion({ content, value, onChange }: NumberQuestionProps) {
  const themeColors = useThemeColors();

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
      <View className="border-border bg-card flex-row items-center gap-1 rounded-lg border pl-3 pr-2">
        <TextInput
          className="text-on-surface flex-1 text-base"
          placeholder={content.placeholder ?? "Enter a number..."}
          placeholderTextColor={themeColors.inactive}
          value={value}
          onChangeText={handleTextChange}
          keyboardType="numeric"
        />

        {hasValue && (
          <TouchableOpacity className="bg-gray-background rounded-md p-1" onPress={handleClear}>
            <X size={20} color={colors.neutral.black} />
          </TouchableOpacity>
        )}
      </View>

      <View className="mt-2">
        {content.min !== undefined && content.max !== undefined && (
          <Text className="text-muted-foreground text-sm">
            Range: {content.min} - {content.max}
          </Text>
        )}
        {content.min !== undefined && content.max === undefined && (
          <Text className="text-muted-foreground text-sm">Minimum: {content.min}</Text>
        )}
        {content.max !== undefined && content.min === undefined && (
          <Text className="text-muted-foreground text-sm">Maximum: {content.max}</Text>
        )}
        {content.required && isNaN(parseFloat(value)) && (
          <Text className="text-destructive text-sm">This field is required</Text>
        )}
      </View>
    </View>
  );
}
