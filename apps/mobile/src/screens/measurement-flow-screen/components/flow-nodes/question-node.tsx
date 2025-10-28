import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FlowNode } from "../../types";
import { MultipleChoiceQuestion } from "./question-types/multiple-choice-question";
import { NumberQuestion } from "./question-types/number-question";
import { SingleChoiceQuestion } from "./question-types/single-choice-question";
import { TextQuestion } from "./question-types/text-question";

interface QuestionNodeProps {
  node: FlowNode;
}

export function QuestionNode({ node }: QuestionNodeProps) {
  const { classes } = useTheme();
  const { nextStep, iterationCount } = useMeasurementFlowStore();
  const { setAnswer, getAnswer, isAutoincrementEnabled } = useFlowAnswersStore();

  const content = node.content;

  // Get current answer from store
  const answerValue = getAnswer(iterationCount, node.name) ?? "";

  // Handler to update answer in store
  const handleAnswerChange = (value: string) => {
    setAnswer(iterationCount, node.name, value);
  };

  const handleNextStep = () => {
    // Handle autoincrement for multi_choice questions
    if (content.kind === "multi_choice") {
      const isAutoincrement = isAutoincrementEnabled(node.name);
      if (isAutoincrement && answerValue) {
        const options = content.options ?? [];
        const currentIndex = options.indexOf(answerValue);
        const nextValue = options[currentIndex + 1] ?? answerValue;
        setAnswer(iterationCount + 1, node.name, nextValue);
      } else if (!isAutoincrement) {
        setAnswer(iterationCount + 1, node.name, answerValue);
      }
    }
    nextStep();
  };

  const renderQuestionType = () => {
    switch (content.kind) {
      case "text":
        return <TextQuestion content={content} value={answerValue} onChange={handleAnswerChange} />;
      case "number":
        return (
          <NumberQuestion content={content} value={answerValue} onChange={handleAnswerChange} />
        );
      case "single_choice":
        return (
          <SingleChoiceQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={handleAnswerChange}
          />
        );
      case "multi_choice":
        return (
          <MultipleChoiceQuestion
            node={node}
            selectedValue={answerValue}
            onSelect={handleAnswerChange}
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
          onPress={handleNextStep}
          isDisabled={!currentIsValid}
          style={{ width: "100%" }}
        />
      </View>
    </View>
  );
}
