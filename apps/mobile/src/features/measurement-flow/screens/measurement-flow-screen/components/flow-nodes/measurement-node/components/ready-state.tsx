import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, HelpCircle, Repeat2 } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { FlowNode } from "../../../../types";

const answerText = cva("flex-shrink text-base", {
  variants: {
    state: {
      answered: "font-semibold",
      unanswered: "italic",
    },
  },
});

interface ReadyStateProps {
  onCardPress: (index: number) => void;
}

export function ReadyState({ onCardPress }: ReadyStateProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation("measurementFlow");
  const { flowNodes, iterationCount } = useMeasurementFlowStore();
  const { getAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } = useFlowAnswersStore();

  const questionEntries: { node: FlowNode; index: number }[] = flowNodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === "question");

  const hasQuestions = questionEntries.length > 0;

  if (!hasQuestions) {
    return (
      <View className="flex-1 items-center justify-center">
        <View className="bg-surface mb-4 h-14 w-14 items-center justify-center rounded-full">
          <HelpCircle size={26} color={themeColors.onSurface} />
        </View>
        <Text className="text-muted-foreground text-center text-base font-medium">
          {t("measurementFlow:measurementNode.readyState.noQuestions")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 pt-4">
        <Text className="text-foreground text-lg font-bold">
          {t("measurementFlow:measurementNode.readyState.overviewHeading")}
        </Text>
      </View>

      <ScrollView
        className="flex-1 p-4"
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {questionEntries.map(({ node, index }, position) => {
          const label =
            node.content?.text ??
            node.name ??
            t("measurementFlow:measurementNode.readyState.defaultQuestionLabel");
          const answer = getAnswer(iterationCount, node.id);
          const hasAnswer = !!answer?.trim();
          const isAutoincrement = isAutoincrementEnabled(node.id);
          const isRemember = isRememberAnswerEnabled(node.id);
          const BADGE_SIZE = 32;

          return (
            <TouchableOpacity
              key={node.id}
              onPress={() => onCardPress(index)}
              activeOpacity={0.7}
              className="bg-gray-background mb-2 flex-row items-stretch gap-4 rounded-xl p-4"
            >
              <View className="items-center justify-center">
                <LinearGradient
                  colors={["#002F2F", "#005E5E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={{
                    width: BADGE_SIZE,
                    height: BADGE_SIZE,
                    borderRadius: BADGE_SIZE / 2,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-lg font-bold text-white">{position + 1}</Text>
                </LinearGradient>
              </View>

              <View className="flex-1 gap-1">
                <Text className="text-muted-foreground text-xs font-medium" numberOfLines={1}>
                  {label}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text
                    numberOfLines={1}
                    className={clsx(
                      answerText({ state: hasAnswer ? "answered" : "unanswered" }),
                      hasAnswer ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {hasAnswer ? answer : t("measurementFlow:measurementNode.readyState.notSet")}
                  </Text>

                  {(isAutoincrement || isRemember) &&
                    (isAutoincrement ? (
                      <Repeat2 size={16} color={themeColors.onSurface} />
                    ) : (
                      <Bookmark size={16} color={themeColors.onSurface} />
                    ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
