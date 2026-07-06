import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { ChevronRight, Pause, Trash2 } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFlowStepInfo } from "~/features/measurement-flow/hooks/use-flow-step-info";
import { teardownFlow } from "~/features/measurement-flow/services/flow-actions";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";
import { flushWorkbookSnapshot } from "~/features/measurement-flow/stores/use-workbook-flow-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function ExitFlowSheet() {
  const isOpen = useExitFlowSheetStore((s) => s.isOpen);
  const close = useExitFlowSheetStore((s) => s.close);
  const router = useRouter();
  const dismissFlow = () => {
    // Pop the pushed flow back to the tab it launched from; fall back to the
    // tabs root if the flow was somehow the entry route (e.g. a deep link).
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/");
  };
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { sheetRef, renderBackdrop } = useBottomSheetController({
    visible: isOpen,
    dismissKeyboardOnPresent: true,
  });
  const { currentStep, totalSteps } = useFlowStepInfo();

  // Pause just leaves the screen. The flow + answers stores are persisted,
  // so the next launch (or tap on the home Resume card) rehydrates exactly
  // where the user left off. Flush the debounced runner snapshot first.
  const handlePause = () => {
    flushWorkbookSnapshot();
    close();
    dismissFlow();
  };

  const handleDiscard = () => {
    teardownFlow();
    close();
    dismissFlow();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={close}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      stackBehavior="push"
    >
      <BottomSheetView className="bg-card gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("exitSheet.title")}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("exitSheet.body", { step: currentStep, total: totalSteps })}
        </Text>

        <Pressable
          onPress={handlePause}
          className="bg-jii-mint-light border-jii-mint flex-row items-center gap-3 rounded-2xl border p-3.5"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: themeColors.brand + "30" }}
          >
            <Pause size={20} color={themeColors.brand} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-bold" style={{ color: themeColors.brand }}>
              {t("exitSheet.pause")}
            </Text>
            <Text className="text-muted-body mt-0.5 text-[12.5px]">{t("exitSheet.pauseSub")}</Text>
          </View>
          <ChevronRight size={20} color={themeColors.brand} />
        </Pressable>

        <Pressable
          onPress={handleDiscard}
          className="border-error/40 bg-card flex-row items-center gap-3 rounded-2xl border p-3.5"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#fee2e2" }}
          >
            <Trash2 size={20} color={colors.semantic.error} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-error text-[15px] font-bold">{t("exitSheet.discard")}</Text>
            <Text className="text-muted-body mt-0.5 text-[12.5px]">
              {t("exitSheet.discardSub")}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.semantic.error} />
        </Pressable>

        <Button title={t("exitSheet.continue")} onPress={close} variant="ghost" size="md" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
