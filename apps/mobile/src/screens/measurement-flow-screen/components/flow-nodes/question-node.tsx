import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { QuestionContent } from "../../types";
import { MultipleChoiceQuestion } from "./question-types/multiple-choice-question";
import { NumberQuestion } from "./question-types/number-question";
import { SingleChoiceQuestion } from "./question-types/single-choice-question";
import { TextQuestion } from "./question-types/text-question";

interface QuestionNodeProps {
  content: QuestionContent;
}

export function QuestionNode({ content }: QuestionNodeProps) {
  const { classes } = useTheme();

  console.log("content", content);

  const renderQuestionType = () => {
    switch (content.kind) {
      case "text":
        return <TextQuestion content={content} />;
      case "number":
        return <NumberQuestion content={content} />;
      case "single_choice":
        return <SingleChoiceQuestion content={content} />;
      case "multi_choice":
        return <MultipleChoiceQuestion content={content} />;
      default:
        return (
          <View className="p-4">
            <Text className={clsx("text-center", classes.textSecondary)}>
              Unsupported question kind: {content.kind}
            </Text>
          </View>
        );
    }
  };

  return (
    <View className={clsx("rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Question</Text>
        {content.required && (
          <Text className={clsx("text-sm text-red-500", classes.text)}>* Required</Text>
        )}
      </View>

      <View className="p-4">
        <Text className={clsx("mb-4 text-base leading-6", classes.text)}>{content.text}</Text>

        {renderQuestionType()}
      </View>
    </View>
  );
}
