import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface SessionStartSheetProps {
  isOpen: boolean;
  assignedPlots: number;
  totalPlots: number;
  onStart: () => void;
  onClose: () => void;
}

export function SessionStartSheet({
  isOpen,
  assignedPlots,
  totalPlots,
  onStart,
  onClose,
}: SessionStartSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation("measurementFlow");
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
          {t("sessionSheet.plots", { assigned: assignedPlots, total: totalPlots })}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">{t("sessionSheet.offline")}</Text>

        <Button title={t("sessionSheet.start")} onPress={onStart} size="lg" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
