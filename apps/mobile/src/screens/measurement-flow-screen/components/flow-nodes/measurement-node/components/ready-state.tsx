import { clsx } from "clsx";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, HelpCircle, Repeat2 } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import type { FlowNode } from "../../../../types";

interface ReadyStateProps {
  onCardPress: (index: number) => void;
}

export function ReadyState({ onCardPress }: ReadyStateProps) {
  const { classes, colors } = useTheme();
  const { flowNodes, iterationCount } = useMeasurementFlowStore();
  const { getAnswer, isAutoincrementEnabled, isRememberAnswerEnabled } = useFlowAnswersStore();

  const questionEntries: { node: FlowNode; index: number }[] = flowNodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === "question");

  const hasQuestions = questionEntries.length > 0;

  if (!hasQuestions) {
    return (
      <View className="flex-1 items-center justify-center">
        <View
          className={clsx(
            "mb-4 h-14 w-14 items-center justify-center rounded-full",
            classes.surface,
          )}
        >
          <HelpCircle size={26} color={colors.onSurface} />
        </View>
        <Text className={clsx("text-center text-base font-medium", classes.textSecondary)}>
          This flow has no questions, start measuring directly!
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="px-4 pt-4">
        <Text className={clsx("text-lg font-bold", classes.text)}>Overview of your answers</Text>
      </View>

      <ScrollView
        className="flex-1 p-4"
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {questionEntries.map(({ node, index }, position) => {
          const label = node.name ?? node.content?.text ?? "Question";
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
              className="mb-2 flex-row items-stretch gap-4 rounded-xl bg-[#F6F8FA] p-4"
            >
              <View style={{ alignItems: "center", justifyContent: "center" }}>
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
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                    {position + 1}
                  </Text>
                </LinearGradient>
              </View>

              <View className="flex-1 gap-1">
                <Text className={clsx("text-xs font-medium", classes.textSecondary)}>{label}</Text>
                <Text
                  className={clsx(
                    "text-base font-semibold",
                    hasAnswer ? classes.text : classes.textSecondary,
                  )}
                  numberOfLines={1}
                >
                  {hasAnswer ? answer : "Not set"}
                </Text>
              </View>

              {(isAutoincrement || isRemember) && (
                <View className="items-center justify-center">
                  {isAutoincrement ? (
                    <Repeat2 size={20} color={colors.primary.dark} />
                  ) : (
                    <Bookmark size={20} color={colors.primary.dark} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
