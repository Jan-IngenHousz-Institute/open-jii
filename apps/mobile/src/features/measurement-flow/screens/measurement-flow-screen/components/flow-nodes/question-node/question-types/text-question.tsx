import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { QuestionContent } from "~/shared/measurements/flow-node";
import { Input } from "~/shared/ui/Input";

interface TextQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function TextQuestion({ content, value, onChange }: TextQuestionProps) {
  const { t } = useTranslation("measurementFlow");

  return (
    <View>
      <Input
        placeholder={content.placeholder ?? t("measurementFlow:questionTypes.text.placeholder")}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        containerStyle={{ marginBottom: 0 }}
      />
      {content.required && !value && (
        <Text className="text-destructive mt-2 text-sm">
          {t("measurementFlow:questionTypes.text.required")}
        </Text>
      )}
    </View>
  );
}
