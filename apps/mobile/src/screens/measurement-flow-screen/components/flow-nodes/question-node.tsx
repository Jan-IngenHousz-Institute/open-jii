import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

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
  const { nextStep } = useMeasurementFlowStore();
  const [answerValue, setAnswerValue] = React.useState<string>("");

  const renderQuestionType = () => {
    switch (content.kind) {
      case "text":
        return <TextQuestion content={content} value={answerValue} onChange={setAnswerValue} />;
      case "number":
        return <NumberQuestion content={content} value={answerValue} onChange={setAnswerValue} />;
      case "single_choice":
        return (
          <SingleChoiceQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={(value) => setAnswerValue(value)}
          />
        );
      case "multi_choice":
        return (
          <MultipleChoiceQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={(value) => setAnswerValue(value)}
          />
        );
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

  const currentIsValid = !content.required || !!answerValue;

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>{content.text}</Text>
      </View>

      <View className="flex-1 p-4">{renderQuestionType()}</View>

      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <Button
          title="Next"
          onPress={nextStep}
          isDisabled={!currentIsValid}
          style={{ width: "100%" }}
        />
      </View>
    </View>
  );
}
