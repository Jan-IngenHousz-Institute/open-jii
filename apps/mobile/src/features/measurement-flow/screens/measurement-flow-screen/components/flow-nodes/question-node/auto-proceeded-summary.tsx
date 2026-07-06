import { Repeat2 } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { useTranslation } from "~/shared/i18n";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface AutoProceededSummaryProps {
  currentNodeId: string;
  iterationCount: number;
}

// The banner is anchored to whichever question node was the first manual
// question at the start of the iteration. The flow store computes the
// anchor once per iteration (store field `iterationAnchor`), so toggling
// "remember answer" or navigating to the overview and back does not move the
// banner mid-iteration. The banner content (which auto-proceeded questions
// exist and their current answers) remains fully dynamic, so the banner
// disappears if there are no auto-proceeded answers.
export function AutoProceededSummary({ currentNodeId, iterationCount }: AutoProceededSummaryProps) {
  const flowNodes = useWorkbookFlowStore((s) => s.flowNodes);
  const anchor = useWorkbookFlowStore((s) => s.iterationAnchor);
  const { getAnswer, isAutoincrementEnabled } = useFlowAnswersStore();
  const themeColors = useThemeColors();
  const { t } = useTranslation("measurementFlow");

  const firstManualNodeId = anchor?.iteration === iterationCount ? anchor.nodeId : undefined;

  const autoProceededWithAnswers = flowNodes
    .filter((n) => n.type === "question" && isAutoincrementEnabled(n.id))
    .filter((n) => !!getAnswer(iterationCount, n.id)?.trim());

  const show =
    iterationCount > 0 &&
    autoProceededWithAnswers.length > 0 &&
    firstManualNodeId === currentNodeId;

  if (!show) return null;

  return (
    <View className="bg-gray-background gap-1 rounded-xl p-2">
      <Text numberOfLines={1} ellipsizeMode="tail" className="text-muted-foreground text-sm">
        {t("measurementFlow:questionNode.autoProceeded.currentPlot")}
      </Text>

      {autoProceededWithAnswers.map((n) => (
        <View key={n.id}>
          <View className="flex-row items-center gap-1">
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              className="text-foreground shrink text-base font-semibold"
            >
              {getAnswer(iterationCount, n.id)}
            </Text>

            <Repeat2 size={16} color={themeColors.onSurface} />
          </View>
        </View>
      ))}
    </View>
  );
}
