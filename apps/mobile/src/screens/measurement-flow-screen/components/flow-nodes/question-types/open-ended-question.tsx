import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface OpenEndedQuestionProps {
  content: QuestionContent;
  value: string;
  onChange: (text: string) => void;
}

export function OpenEndedQuestion({ content, value, onChange }: OpenEndedQuestionProps) {
  const { classes } = useTheme();
  const [internal, setInternal] = useState(value);

  const handleChange = (text: string) => {
    setInternal(text);
    onChange(text);
  };

  return (
    <View className="flex-1 items-center justify-center">
      <TextInput
        className={clsx("w-full rounded-lg border p-4 text-base", classes.input, classes.border)}
        placeholder={content.placeholder ?? "Enter your answer..."}
        value={internal}
        onChangeText={handleChange}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        style={{ minHeight: 200 }}
      />
      {content.required && !value && (
        <Text className={clsx("mt-2 text-sm text-red-500", classes.text)}>
          This field is required
        </Text>
      )}
    </View>
  );
}
