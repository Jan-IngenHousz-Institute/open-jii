import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { ComeBackPlotRow } from "./come-back-plot-row";
import type { SkippedPlot } from "./next-plot";

interface ComeBackSheetProps {
  skipped: SkippedPlot[];
  isOpen: boolean;
  onMeasure: (identifier: string) => void;
  onClose: () => void;
}

/** The come-back-later list: every skipped plot with its reason, each one tap from measuring. */
export function ComeBackSheet({ skipped, isOpen, onMeasure, onClose }: ComeBackSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });

  const renderPlot = (plot: SkippedPlot) => (
    <ComeBackPlotRow key={plot.identifier} plot={plot} onMeasure={onMeasure} />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      stackBehavior="push"
    >
      <BottomSheetView className="bg-card gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("measurementFlow:comeBack.title")}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("measurementFlow:comeBack.body")}
        </Text>

        <View className="gap-2">{skipped.map(renderPlot)}</View>

        <Button title={t("measurementFlow:comeBack.close")} onPress={onClose} variant="ghost" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
