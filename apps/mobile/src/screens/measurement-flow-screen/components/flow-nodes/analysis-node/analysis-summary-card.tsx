import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { DateTime } from "luxon";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import type { AnswerData } from "~/utils/convert-cycle-answers-to-array";

const answersValueStyle = cva("flex-1", {
  variants: {
    hasAnswers: {
      true: "",
      false: "italic",
    },
  },
});

interface AnalysisSummaryCardProps {
  experimentName: string;
  protocolName?: string;
  questions: AnswerData[];
  displayTimestamp: string;
  onPress: () => void;
}

export function AnalysisSummaryCard({
  experimentName,
  protocolName,
  questions,
  displayTimestamp,
  onPress,
}: AnalysisSummaryCardProps) {
  const { classes } = useTheme();

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <View className="my-4 gap-1.5 rounded-xl bg-[#EDF2F6] p-4">
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>Experiment: </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={clsx("flex-1", classes.textMuted)}
          >
            {experimentName}
          </Text>
        </View>
        {protocolName && (
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>Protocol: </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx("flex-1", classes.textMuted)}
            >
              {protocolName}
            </Text>
          </View>
        )}
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>Answers: </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={clsx(
              answersValueStyle({ hasAnswers: questions.length > 0 }),
              classes.textMuted,
            )}
          >
            {questions.length === 0
              ? "No questions answered"
              : questions.map((q) => q.question_answer).join(" | ")}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>Date: </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={clsx("flex-1", classes.textMuted)}
          >
            {DateTime.fromISO(displayTimestamp).toFormat("d MMMM yyyy, HH:mm")}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
