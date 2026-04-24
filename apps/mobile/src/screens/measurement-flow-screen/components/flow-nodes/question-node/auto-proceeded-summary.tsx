import { clsx } from "clsx";
import { Repeat2 } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

interface AutoProceededSummaryProps {
  currentNodeId: string;
  iterationCount: number;
}

// The banner is anchored to whichever question node was the first not remembered question at the start of
// the iteration. This anchor is cached so that toggling "remember answer" or navigating to the
// overview and back does not move the banner to a different question mid-iteration.
// The banner content (which auto-proceeded questions exist and their current answers) and its
// visibility remain fully dynamic, so the banner disappears if there are no auto-proceeded answers.
let cachedForIteration = -1;
let cachedFirstManualNodeId: string | undefined;

export function getCachedFirstManualNodeId(iterationCount: number): string | undefined {
  if (cachedForIteration === iterationCount) {
    return cachedFirstManualNodeId;
  }

  const { flowNodes } = useMeasurementFlowStore.getState();
  const { isAutoincrementEnabled, isRememberAnswerEnabled } = useFlowAnswersStore.getState();

  const questionNodes = flowNodes.filter((n) => n.type === "question");
  const manualNodes = questionNodes.filter(
    (n) => !isAutoincrementEnabled(n.id) && !isRememberAnswerEnabled(n.id),
  );

  cachedForIteration = iterationCount;
  cachedFirstManualNodeId = manualNodes[0]?.id;
  return cachedFirstManualNodeId;
}

export function AutoProceededSummary({ currentNodeId, iterationCount }: AutoProceededSummaryProps) {
  const theme = useTheme();
  const { classes, colors } = theme;
  const { flowNodes } = useMeasurementFlowStore();
  const { getAnswer, isAutoincrementEnabled } = useFlowAnswersStore();

  const firstManualNodeId = getCachedFirstManualNodeId(iterationCount);

  const firstAutoProceeded = flowNodes.find(
    (n) =>
      n.type === "question" &&
      isAutoincrementEnabled(n.id) &&
      !!getAnswer(iterationCount, n.id)?.trim(),
  );

  const show = iterationCount > 0 && !!firstAutoProceeded && firstManualNodeId === currentNodeId;

  if (!show) return null;

  return (
    <View
      className="gap-1 rounded-xl p-2"
      style={{
        backgroundColor: theme.isDark ? colors.dark.grayBackground : colors.light.grayBackground,
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className={clsx("text-sm", classes.textSecondary)}
      >
        Your current plot
      </Text>

      <View className="flex-row items-center gap-1">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className={clsx("flex-shrink text-base font-semibold", classes.text)}
        >
          {getAnswer(iterationCount, firstAutoProceeded.id)}
        </Text>

        <Repeat2 size={16} color={colors.neutral.black} />
      </View>
    </View>
  );
}
