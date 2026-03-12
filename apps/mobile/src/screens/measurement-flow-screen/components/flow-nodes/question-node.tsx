import { clsx } from "clsx";
import { Repeat2, Search, X, Bookmark } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity } from "react-native";
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
import { advanceWithAnswer } from "./utils/advance-with-answer";

interface QuestionNodeProps {
  node: FlowNode;
}

export function QuestionNode({ node }: QuestionNodeProps) {
  const { iterationCount } = useMeasurementFlowStore();
  const theme = useTheme();
  const { classes, colors } = theme;
  const {
    setAnswer,
    getAnswer,
    isAutoincrementEnabled,
    setRememberAnswer,
    isRememberAnswerEnabled,
    setAutoincrement,
  } = useFlowAnswersStore();

  const content = node.content;
  const [searchTerm, setSearchTerm] = useState("");

  // Get current answer from store (using node.id as key)
  const answerValue = getAnswer(iterationCount, node.id) ?? "";

  // Handler to update answer in store
  const handleAnswerChange = (value: string) => {
    setAnswer(iterationCount, node.id, value);
  };

  // Handler for yes/no and multi_choice that auto-advances
  const handleAnswerChangeAndAdvance = (value: string) => {
    // Set the answer
    setAnswer(iterationCount, node.id, value);
    // Use shared utility to advance with proper answer handling
    advanceWithAnswer(node, value);
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
            onSelect={handleAnswerChangeAndAdvance}
            searchTerm={searchTerm}
          />
        );
      case "yes_no":
        return (
          <YesNoQuestion
            content={content}
            selectedValue={answerValue}
            onSelect={handleAnswerChangeAndAdvance}
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

  return (
    <View className={clsx("flex-1 gap-4 rounded-xl px-4 pt-4")}>
      <Text className={clsx("text-lg font-bold", classes.text)}>{content.text}</Text>

      <View className="flex-row items-center gap-4">
        {content.kind === "multi_choice" ? (
          <>
            <Checkbox
              value={isRememberAnswerEnabled(node.id)}
              text="Remember answer"
              textSize="sm"
              icon={<Bookmark size={16} color={colors.neutral.black} />}
              onChange={(enabled) => {
                setRememberAnswer(node.id, enabled);
                // Disable autoincrement when remember answer is enabled
                if (enabled) {
                  setAutoincrement(node.id, false);
                }
              }}
            />
            <Checkbox
              value={isAutoincrementEnabled(node.id)}
              text="Auto proceed"
              textSize="sm"
              icon={<Repeat2 size={16} color={colors.neutral.black} />}
              onChange={(enabled) => {
                setAutoincrement(node.id, enabled);
                // Disable remember answer when autoincrement is enabled
                if (enabled) {
                  setRememberAnswer(node.id, false);
                }
              }}
            />
          </>
        ) : (
          <Checkbox
            value={isRememberAnswerEnabled(node.id)}
            text="Remember answer"
            textSize="sm"
            onChange={(enabled) => setRememberAnswer(node.id, enabled)}
          />
        )}
      </View>

      {content.kind === "multi_choice" && (
        <View
          className={clsx(
            "flex-row items-center gap-2 rounded-xl border bg-white px-4",
            classes.border,
            classes.input,
          )}
        >
          <Search size={20} color={theme.isDark ? colors.dark.inactive : colors.light.inactive} />

          <TextInput
            className="flex-1 text-base"
            placeholder="Search options..."
            placeholderTextColor={theme.isDark ? colors.dark.inactive : colors.light.inactive}
            style={{ color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface }}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <X size={20} color={theme.isDark ? colors.dark.inactive : colors.light.inactive} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1">{renderQuestionType()}</View>
      </ScrollView>
    </View>
  );
}
