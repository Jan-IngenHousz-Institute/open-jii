import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface MeasuredPlotSheetProps {
  plot: string;
  measuredAt: string;
  isOpen: boolean;
  onMeasureAgain: () => void;
  onClose: () => void;
}

/** Asks before a plot already measured this session is measured again as a repeat. */
export function MeasuredPlotSheet({
  plot,
  measuredAt,
  isOpen,
  onMeasureAgain,
  onClose,
}: MeasuredPlotSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });

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
          {t("measurementFlow:measuredPlot.title", { plot, time: measuredAt })}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("measurementFlow:measuredPlot.body", { plot })}
        </Text>

        <Button
          title={t("measurementFlow:measuredPlot.measureAgain", { plot })}
          onPress={onMeasureAgain}
          size="lg"
        />
        <Button
          title={t("measurementFlow:measuredPlot.pickAnother")}
          onPress={onClose}
          variant="ghost"
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
