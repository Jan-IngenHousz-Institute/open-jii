import { clsx } from "clsx";
import { CheckCircle2, Circle } from "lucide-react-native";
import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

import type { FlowNode } from "../../types";
import { FlowProgressIndicator } from "../flow-progress-indicator";

export function QuestionsOverview() {
  const { classes, colors } = useTheme();
  const {
    flowNodes,
    iterationCount,
    setCurrentFlowStep,
    setShowingOverview,
    setReturnToOverviewAfterEdit,
  } = useMeasurementFlowStore();
  const { getAnswer } = useFlowAnswersStore();

  const questionEntries: { node: FlowNode; index: number }[] = flowNodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === "question");

  const handleCardPress = (flowStepIndex: number) => {
    setCurrentFlowStep(flowStepIndex);
    setReturnToOverviewAfterEdit(true);
    setShowingOverview(false);
  };

  const handleMeasure = () => {
    const measurementIndex = flowNodes.findIndex((n) => n.type === "measurement");
    if (measurementIndex >= 0) {
      setCurrentFlowStep(measurementIndex);
    }
    setShowingOverview(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <FlowProgressIndicator />
      <View className="mb-4 px-1">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Questions overview</Text>
        <Text className={clsx("mt-1 text-sm", classes.textSecondary)}>
          Tap a card to edit. When ready, tap Measure to continue.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {questionEntries.map(({ node, index }) => {
          const label = node.name ?? node.content?.text ?? "Question";
          const answer = getAnswer(iterationCount, node.id);
          const hasAnswer = !!answer?.trim();

          return (
            <TouchableOpacity
              key={node.id}
              onPress={() => handleCardPress(index)}
              activeOpacity={0.7}
              className={clsx(
                "mb-3 flex-row items-center rounded-xl border p-4",
                classes.card,
                classes.border,
              )}
            >
              <View className="flex-1">
                <Text className={clsx("text-xs font-medium", classes.textSecondary)}>{label}</Text>
                <Text
                  className={clsx(
                    "mt-1 text-base font-semibold",
                    hasAnswer ? classes.text : classes.textSecondary,
                  )}
                  numberOfLines={1}
                >
                  {hasAnswer ? answer : "Not set"}
                </Text>
              </View>
              <View className="ml-3">
                {hasAnswer ? (
                  <CheckCircle2 size={24} color={colors.semantic.success} />
                ) : (
                  <Circle size={24} color={colors.semantic.warning} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View className={clsx("border-t p-4", classes.border)}>
        <Button
          title="Measure"
          variant="primary"
          size="lg"
          onPress={handleMeasure}
          style={{ width: "100%" }}
        />
      </View>
    </View>
  );
}
