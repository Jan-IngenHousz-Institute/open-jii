import { useIsFocused } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { BackHandler, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { ExitFlowSheet } from "~/features/measurement-flow/components/exit-flow-sheet";
import { FlowHero } from "~/features/measurement-flow/components/flow-hero";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";

import { MeasurementFlowContainer } from "./components/measurement-flow-container";
import { NavigationButtons } from "./components/navigation-buttons";

interface MeasurementFlowScreenProps {
  /** Called after flow is ended (e.g. to navigate back to landing) */
  onEndFlowComplete?: () => void;
}

export function MeasurementFlowScreen(_props: MeasurementFlowScreenProps = {}) {
  useKeepAwake();
  const {
    flowNodes,
    currentFlowStep,
    isFlowFinished,
    experimentId,
    protocolId,
    isQuestionsSubmitPending,
    iterationCount,
    isFromOverview,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const openExitSheet = useExitFlowSheetStore((s) => s.open);

  const experimentLabel = experiments.find((e) => e.value === experimentId)?.label ?? "";

  // Auto-save a snapshot when the user leaves a mid-flow screen without
  // explicitly ending it. The Exit sheet's Discard path clears the runner
  // first, so this guard skips finished/empty flows.
  React.useEffect(() => {
    if (isFocused) return;
    if (!experimentId) return;
    if (isFlowFinished) return;
    if (currentFlowStep <= 0 && !isQuestionsSubmitPending) return;

    const answersHistory = useFlowAnswersStore.getState().answersHistory;

    usePausedFlowStore.getState().pauseFlow({
      experimentId,
      experimentLabel,
      protocolId,
      currentFlowStep,
      totalSteps: flowNodes.length,
      iterationCount,
      isQuestionsSubmitPending,
      isFromOverview,
      flowNodes,
      answersHistory: JSON.parse(JSON.stringify(answersHistory)),
      pausedAt: new Date().toISOString(),
    });
  }, [
    isFocused,
    experimentId,
    experimentLabel,
    protocolId,
    currentFlowStep,
    flowNodes,
    iterationCount,
    isQuestionsSubmitPending,
    isFromOverview,
    isFlowFinished,
  ]);

  // Android hardware back routes through the Exit sheet when a flow is active.
  React.useEffect(() => {
    if (!isFocused) return;
    if (!experimentId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      openExitSheet();
      return true;
    });
    return () => sub.remove();
  }, [isFocused, experimentId, openExitSheet]);

  const hasActiveFlow = !!experimentId;

  return (
    <View className="bg-background flex-1" style={{ paddingBottom: insets.bottom }}>
      {isFocused && <StatusBar style={hasActiveFlow ? "light" : "dark"} />}

      {hasActiveFlow ? (
        <FlowHero title={experimentLabel} onExitPress={openExitSheet} />
      ) : (
        <View style={{ height: insets.top }} />
      )}

      <View className="flex-1">
        <MeasurementFlowContainer />

        <NavigationButtons />
      </View>

      <ExitFlowSheet />
    </View>
  );
}
