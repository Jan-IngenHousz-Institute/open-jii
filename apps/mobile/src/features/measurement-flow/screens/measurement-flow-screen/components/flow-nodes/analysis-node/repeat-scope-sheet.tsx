import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface RepeatScopeSheetProps {
  plot: string;
  isOpen: boolean;
  onMeasurementOnly: () => void;
  onWholeRound: () => void;
  onClose: () => void;
}

/** Asks what a repeat takes again: the measurement alone, or every step of the round. */
export function RepeatScopeSheet({
  plot,
  isOpen,
  onMeasurementOnly,
  onWholeRound,
  onClose,
}: RepeatScopeSheetProps) {
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
          {t("measurementFlow:repeatScope.title", { plot })}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("measurementFlow:repeatScope.body", { plot })}
        </Text>

        <View className="gap-1.5">
          <Button
            title={t("measurementFlow:repeatScope.measurementOnly")}
            onPress={onMeasurementOnly}
            size="lg"
          />
          <Text className="text-muted-body text-[13px] leading-5">
            {t("measurementFlow:repeatScope.measurementOnlyDetail")}
          </Text>
        </View>
        <View className="gap-1.5">
          <Button
            title={t("measurementFlow:repeatScope.wholeRound")}
            onPress={onWholeRound}
            variant="outline"
            size="lg"
          />
          <Text className="text-muted-body text-[13px] leading-5">
            {t("measurementFlow:repeatScope.wholeRoundDetail", { plot })}
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
