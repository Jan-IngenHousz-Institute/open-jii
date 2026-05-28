import { X } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { QuestionContent } from "../../../../types";

interface NumberQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function NumberQuestion({ content, value, onChange }: NumberQuestionProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation("measurementFlow");

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
      <Input
        placeholder={content.placeholder ?? t("measurementFlow:questionTypes.number.placeholder")}
        value={value}
        onChangeText={handleTextChange}
        keyboardType="numeric"
        containerStyle={{ marginBottom: 0 }}
        rightElement={
          hasValue ? (
            <TouchableOpacity
              className="bg-gray-background mr-2 rounded-md p-1"
              onPress={handleClear}
            >
              <X size={20} color={themeColors.onSurface} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <View className="mt-2">
        {content.min !== undefined && content.max !== undefined && (
          <Text className="text-muted-foreground text-sm">
            {t("measurementFlow:questionTypes.number.range", {
              min: content.min,
              max: content.max,
            })}
          </Text>
        )}
        {content.min !== undefined && content.max === undefined && (
          <Text className="text-muted-foreground text-sm">
            {t("measurementFlow:questionTypes.number.minimum", { min: content.min })}
          </Text>
        )}
        {content.max !== undefined && content.min === undefined && (
          <Text className="text-muted-foreground text-sm">
            {t("measurementFlow:questionTypes.number.maximum", { max: content.max })}
          </Text>
        )}
        {content.required && isNaN(parseFloat(value)) && (
          <Text className="text-destructive text-sm">
            {t("measurementFlow:questionTypes.number.required")}
          </Text>
        )}
      </View>
    </View>
  );
}
