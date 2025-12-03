import { clsx } from "clsx";
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Button } from "~/components/Button";
import { Checkbox } from "~/components/Checkbox";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import { FlowNode } from "../../types";
import { MultipleChoiceQuestion } from "./question-types/multiple-choice-question";
import { NumberQuestion } from "./question-types/number-question";
import { OpenEndedQuestion } from "./question-types/open-ended-question";
import { SingleChoiceQuestion } from "./question-types/single-choice-question";
import { TextQuestion } from "./question-types/text-question";
import { YesNoQuestion } from "./question-types/yes-no-question";

interface QuestionNodeProps {
  node: FlowNode;
}

export function QuestionNode({ node }: QuestionNodeProps) {
  const { classes } = useTheme();
  const { nextStep, iterationCount } = useMeasurementFlowStore();
  const {
    setAnswer,
    getAnswer,
    isAutoincrementEnabled,
    setRememberAnswer,
    isRememberAnswerEnabled,
    setAutoincrement,
  } = useFlowAnswersStore();

  const content = node.content;

  // Get current answer from store (using node.id as key)
  const answerValue = getAnswer(iterationCount, node.id) ?? "";

  // Handler to update answer in store
  const handleAnswerChange = (value: string) => {
    setAnswer(iterationCount, node.id, value);
  };

  const handleNextStep = () => {
    // Handle autoincrement for multi_choice questions (mutually exclusive with remember answer)
    if (content.kind === "multi_choice") {
      const isAutoincrement = isAutoincrementEnabled(node.id);
      if (isAutoincrement && answerValue) {
        const options = content.options ?? [];
        const currentIndex = options.indexOf(answerValue);
        const nextIndex = (currentIndex + 1) % options.length;
        const nextValue = options[nextIndex];
        setAnswer(iterationCount + 1, node.id, nextValue);
        nextStep();
        return; // Don't process remember answer if autoincrement is enabled
      }
    }

    // Handle remember answer for all question types (mutually exclusive with autoincrement for multi_choice)
    const shouldRemember = isRememberAnswerEnabled(node.id);
    if (shouldRemember && answerValue) {
      setAnswer(iterationCount + 1, node.id, answerValue);
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
      case "yes_no":
        return (
          <YesNoQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={handleAnswerChange}
          />
        );
      case "open_ended":
        return (
          <OpenEndedQuestion content={content} value={answerValue} onChange={handleAnswerChange} />
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View className="border-b border-gray-200 p-4 dark:border-gray-700">
          <Text className={clsx("text-lg font-semibold", classes.text)}>{content.text}</Text>
        </View>

        <View className="flex-1 p-4">{renderQuestionType()}</View>
      </ScrollView>

      <View className={clsx("border-t p-4", classes.border)}>
        <View className="mb-3 flex-row items-center justify-between">
          {content.kind === "multi_choice" ? (
            <>
              <View className="flex-1">
                <Checkbox
                  value={isAutoincrementEnabled(node.id)}
                  text="Auto Increment"
                  textSize="sm"
                  onChange={(enabled) => {
                    setAutoincrement(node.id, enabled);
                    // Disable remember answer when autoincrement is enabled
                    if (enabled) {
                      setRememberAnswer(node.id, false);
                    }
                  }}
                />
              </View>
              <View className="flex-1 items-end">
                <Checkbox
                  value={isRememberAnswerEnabled(node.id)}
                  text="Remember Answer"
                  textSize="sm"
                  checkboxPosition="right"
                  onChange={(enabled) => {
                    setRememberAnswer(node.id, enabled);
                    // Disable autoincrement when remember answer is enabled
                    if (enabled) {
                      setAutoincrement(node.id, false);
                    }
                  }}
                />
              </View>
            </>
          ) : (
            <>
              <View className="flex-1" />
              <View className="flex-1 items-end">
                <Checkbox
                  value={isRememberAnswerEnabled(node.id)}
                  text="Remember Answer"
                  textSize="sm"
                  checkboxPosition="right"
                  onChange={(enabled) => setRememberAnswer(node.id, enabled)}
                />
              </View>
            </>
          )}
        </View>
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
