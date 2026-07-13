import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { DateTime } from "luxon";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTranslation } from "~/shared/i18n";
import type { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { useTheme } from "~/shared/ui/hooks/use-theme";

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
  commandName?: string;
  questions: AnswerData[];
  displayTimestamp: string;
  onPress: () => void;
}

export function AnalysisSummaryCard({
  experimentName,
  commandName,
  questions,
  displayTimestamp,
  onPress,
}: AnalysisSummaryCardProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <View className="bg-muted my-4 gap-1.5 rounded-xl p-4">
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>
            {t("measurementFlow:analysis.summary.experiment")}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={clsx("flex-1", classes.textMuted)}
          >
            {experimentName}
          </Text>
        </View>
        {commandName && (
          <View className="flex-row items-center">
            <Text className={clsx("font-semibold", classes.text)}>
              {t("measurementFlow:analysis.summary.command")}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className={clsx("flex-1", classes.textMuted)}
            >
              {commandName}
            </Text>
          </View>
        )}
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>
            {t("measurementFlow:analysis.summary.answers")}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className={clsx(
              answersValueStyle({ hasAnswers: questions.length > 0 }),
              classes.textMuted,
            )}
          >
            {questions.length === 0
              ? t("measurementFlow:analysis.summary.noQuestionsAnswered")
              : questions.map((q) => q.question_answer).join(" | ")}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className={clsx("font-semibold", classes.text)}>
            {t("measurementFlow:analysis.summary.date")}
          </Text>
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
