import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { QuestionContent } from "../../../../types";

interface TextQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function TextQuestion({ content, value, onChange }: TextQuestionProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const [internal, setInternal] = useState(value);
  const handleChange = (text: string) => {
    setInternal(text);
    onChange(text);
  };

  return (
    <View>
      <TextInput
        className={clsx("rounded-lg border p-3 text-base", classes.input, classes.border)}
        placeholder={content.placeholder ?? t("measurementFlow:questionTypes.text.placeholder")}
        value={internal}
        onChangeText={handleChange}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
      {content.required && !value && (
        <Text className="text-destructive mt-2 text-sm">
          {t("measurementFlow:questionTypes.text.required")}
        </Text>
      )}
    </View>
  );
}
