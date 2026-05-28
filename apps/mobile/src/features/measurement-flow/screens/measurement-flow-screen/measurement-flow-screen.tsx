/* eslint-disable @typescript-eslint/no-require-imports */
import { useIsFocused } from "@react-navigation/native";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { X } from "lucide-react-native";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExperiment } from "~/features/experiments/hooks/use-experiment";
import { ExitFlowSheet } from "~/features/measurement-flow/components/exit-flow-sheet";
import { FlowHero } from "~/features/measurement-flow/components/flow-hero";
import { useAutoPauseFlow } from "~/features/measurement-flow/hooks/use-auto-pause-flow";
import { useFlowBackHandler } from "~/features/measurement-flow/hooks/use-flow-back-handler";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
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
  // Subscribe only to the field this screen renders against. The auto-pause
  // and back-handler hooks read the rest of the store via getState() so the
  // screen doesn't re-render on every flow tick (scanResult, currentFlowStep,
  // …) and cascade through MeasurementFlowContainer and its children.
  const experimentId = useMeasurementFlowStore((s) => s.experimentId);
  const { experiment } = useExperiment(experimentId);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const openExitSheet = useExitFlowSheetStore((s) => s.open);
  const router = useRouter();
  const themeColors = useThemeColors();
  const { t } = useTranslation("measurementFlow");

  const experimentLabel = experiment?.name ?? "";
  const hasActiveFlow = !!experimentId;

  useAutoPauseFlow(experimentLabel);
  useFlowBackHandler(hasActiveFlow);

  // Picker state has no tab bar to bail out to (the flow now covers the tabs
  // as a pushed screen with swipe-back disabled), so it gets its own dismiss.
  const dismissFlow = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/");
  };

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
            accessibilityLabel={t("hero.exitLabel")}
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
