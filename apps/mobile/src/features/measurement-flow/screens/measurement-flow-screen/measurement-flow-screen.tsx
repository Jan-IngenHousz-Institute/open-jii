/* eslint-disable @typescript-eslint/no-require-imports */
import { useIsFocused } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import React from "react";
import { BackHandler, Image, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { ExitFlowSheet } from "~/features/measurement-flow/components/exit-flow-sheet";
import { FlowHero } from "~/features/measurement-flow/components/flow-hero";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";
import { colors } from "~/shared/constants/colors";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

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
  const router = useRouter();
  const themeColors = useThemeColors();

  // Picker state has no tab bar to bail out to (the flow now covers the tabs
  // as a pushed screen with swipe-back disabled), so it gets its own dismiss.
  const dismissFlow = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/");
  };

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
      {isFocused && <StatusBar style={hasActiveFlow ? "light" : "auto"} />}

      {hasActiveFlow ? (
        <>
          <Image
            source={HERO_IMAGE}
            className="absolute left-0 right-0 top-0 h-[42%] w-full"
            resizeMode="cover"
          />
          {/* Brand-teal overlay covers the FULL photo area, not just the
              FlowHero's bounding box, so the strip between the hero and the
              body's rounded corner stays consistently masked. */}
          <LinearGradient
            colors={[colors.jii.darkGreen + "88", colors.jii.darkerGreen + "D0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
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
        <View style={{ paddingTop: insets.top }} className="px-2 pb-1">
          <TouchableOpacity
            onPress={dismissFlow}
            hitSlop={8}
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
          >
            <X size={26} color={themeColors.onSurface} />
          </TouchableOpacity>
        </View>
      )}

      <View className="flex-1">
        <MeasurementFlowContainer />

        <NavigationButtons />
      </View>

      <ExitFlowSheet />
    </View>
  );
}
