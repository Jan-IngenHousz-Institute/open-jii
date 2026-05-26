/* eslint-disable @typescript-eslint/no-require-imports */
import { useIsFocused } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { BackHandler, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { ExitFlowSheet } from "~/features/measurement-flow/components/exit-flow-sheet";
import { FlowHero } from "~/features/measurement-flow/components/flow-hero";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";
import { colors } from "~/shared/constants/colors";

import { MeasurementFlowContainer } from "./components/measurement-flow-container";
import { NavigationButtons } from "./components/navigation-buttons";

const HERO_IMAGE = require("../../../../../assets/flow-header.jpg");

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
    scanResult,
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
      scanResult,
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
    scanResult,
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
    <View className="bg-background flex-1">
      {isFocused && <StatusBar style={hasActiveFlow ? "light" : "dark"} />}

      {hasActiveFlow ? (
        <>
          {/* Photo extends ~48% of the screen so the body's larger rounded
              top corners curve over a generous slice of greenhouse — like
              the old design but with more breathing room. */}
          <Image
            source={HERO_IMAGE}
            style={{ position: "absolute", left: 0, right: 0, top: 0, height: "48%" }}
            resizeMode="cover"
          />
          {/* Brand-teal overlay covers the FULL photo area, not just the
              FlowHero's bounding box, so the strip between the hero and the
              body's rounded corner stays consistently masked. */}
          <LinearGradient
            colors={[colors.jii.darkerGreen + "E0", colors.jii.darkGreen + "99"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "48%",
              pointerEvents: "none",
            }}
          />
          <FlowHero title={experimentLabel} onExitPress={openExitSheet} />
        </>
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
