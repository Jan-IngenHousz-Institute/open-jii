import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { ChevronRight, Pause, Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { useExperimentSelectionStore } from "~/features/experiments/stores/use-experiment-selection-store";
import { useFlowStepInfo } from "~/features/measurement-flow/hooks/use-flow-step-info";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { usePausedFlowStore } from "~/features/measurement-flow/stores/use-paused-flow-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function ExitFlowSheet() {
  const isOpen = useExitFlowSheetStore((s) => s.isOpen);
  const close = useExitFlowSheetStore((s) => s.close);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const sheetRef = useRef<BottomSheetModal>(null);
  const { currentStep, totalSteps } = useFlowStepInfo();
  const { experiments } = useExperiments();

  useEffect(() => {
    if (isOpen) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const handlePause = () => {
    const flow = useMeasurementFlowStore.getState();
    const { answersHistory } = useFlowAnswersStore.getState();
    const experimentLabel = experiments.find((e) => e.value === flow.experimentId)?.label ?? "";

    if (flow.experimentId) {
      usePausedFlowStore.getState().pauseFlow({
        experimentId: flow.experimentId,
        experimentLabel,
        protocolId: flow.protocolId,
        currentFlowStep: flow.currentFlowStep,
        totalSteps: flow.flowNodes.length,
        iterationCount: flow.iterationCount,
        isQuestionsSubmitPending: flow.isQuestionsSubmitPending,
        isFromOverview: flow.isFromOverview,
        flowNodes: flow.flowNodes,
        // Deep-clone so later writes to useFlowAnswersStore don't mutate the
        // persisted snapshot (Zustand state is reference-shared).
        answersHistory: JSON.parse(JSON.stringify(answersHistory)),
        pausedAt: new Date().toISOString(),
      });
    }

    flow.resetFlow();
    useExperimentSelectionStore.getState().setSelectedExperimentId(undefined);
    close();
    router.replace("/(tabs)/");
  };

  const handleDiscard = () => {
    usePausedFlowStore.getState().discardPausedFlow();
    useMeasurementFlowStore.getState().resetFlow();
    useFlowAnswersStore.getState().clearHistory();
    useExperimentSelectionStore.getState().setSelectedExperimentId(undefined);
    close();
    router.replace("/(tabs)/");
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={close}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      stackBehavior="push"
    >
      <BottomSheetView className="gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("exitSheet.title")}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("exitSheet.body", { step: currentStep, total: totalSteps })}
        </Text>

        <Pressable
          onPress={handlePause}
          className="border-jii-mint flex-row items-center gap-3 rounded-2xl border p-3.5"
          style={{ backgroundColor: colors.jii.mintLight }}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <Pause size={20} color={colors.jii.darkGreen} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-bold" style={{ color: colors.jii.darkGreen }}>
              {t("exitSheet.pause")}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12.5px]">{t("exitSheet.pauseSub")}</Text>
          </View>
          <ChevronRight size={20} color={colors.jii.darkGreen} />
        </Pressable>

        <Pressable
          onPress={handleDiscard}
          className="border-error/40 bg-card flex-row items-center gap-3 rounded-2xl border p-3.5"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#fee2e2" }}
          >
            <Trash2 size={20} color="#b00020" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-error text-[15px] font-bold">{t("exitSheet.discard")}</Text>
            <Text className="text-muted-body mt-0.5 text-[12.5px]">
              {t("exitSheet.discardSub")}
            </Text>
          </View>
          <ChevronRight size={20} color="#b00020" />
        </Pressable>

        <Button title={t("exitSheet.continue")} onPress={close} variant="ghost" size="md" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
