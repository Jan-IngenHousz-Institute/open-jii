import { clsx } from "clsx";
import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../../types";

interface TextQuestionProps {
  content: QuestionContent;
}

export function TextQuestion({ content }: TextQuestionProps) {
  const { classes } = useTheme();
  const [value, setValue] = useState("");

  return (
    <View>
      <TextInput
        className={clsx("rounded-lg border p-3 text-base", classes.input, classes.border)}
        placeholder={content.placeholder ?? "Enter your answer..."}
        value={value}
        onChangeText={setValue}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
      {content.required && !value && (
        <Text className={clsx("mt-2 text-sm text-red-500", classes.text)}>
          This field is required
        </Text>
      )}
    </View>
  );
}
