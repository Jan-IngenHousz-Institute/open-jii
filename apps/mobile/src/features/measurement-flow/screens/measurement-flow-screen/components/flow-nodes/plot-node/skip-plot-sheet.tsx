import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Ban, Droplets, Ellipsis, Sprout } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { NextPlot, SkipReason } from "./next-plot";
import { SkipNoteField } from "./skip-note-field";
import { SkipReasonRow } from "./skip-reason-row";

interface SkipPlotSheetProps {
  plot: NextPlot;
  isOpen: boolean;
  onChoose: (reason: SkipReason, note?: string) => void;
  onClose: () => void;
}

export function SkipPlotSheet({ plot, isOpen, onChoose, onClose }: SkipPlotSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });
  const [isWritingNote, setIsWritingNote] = useState(false);

  const reasons: { reason: SkipReason; label: string; Icon: LucideIcon }[] = [
    { reason: "plantMissing", label: t("measurementFlow:skipSheet.plantMissing"), Icon: Sprout },
    { reason: "flooded", label: t("measurementFlow:skipSheet.flooded"), Icon: Droplets },
    { reason: "couldNotReach", label: t("measurementFlow:skipSheet.couldNotReach"), Icon: Ban },
    { reason: "other", label: t("measurementFlow:skipSheet.other"), Icon: Ellipsis },
  ];

  const handleChoose = (reason: SkipReason) => {
    if (reason === "other") {
      setIsWritingNote(true);
    } else {
      onChoose(reason);
    }
  };

  const handleSkipWithNote = (note: string | undefined) => {
    setIsWritingNote(false);
    onChoose("other", note);
  };

  const handleDismiss = () => {
    setIsWritingNote(false);
    onClose();
  };

  const renderReason = ({ reason, label, Icon }: (typeof reasons)[number]) => (
    <SkipReasonRow key={reason} reason={reason} label={label} Icon={Icon} onChoose={handleChoose} />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      stackBehavior="push"
    >
      <BottomSheetView className="bg-card gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("measurementFlow:skipSheet.title", { plot: plot.identifier })}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("measurementFlow:skipSheet.body", { plot: plot.identifier })}
        </Text>

        <View className="gap-2">{reasons.map(renderReason)}</View>

        {isWritingNote ? (
          <SkipNoteField plot={plot.identifier} onSkip={handleSkipWithNote} />
        ) : null}

        <Button
          title={t("measurementFlow:skipSheet.cancel")}
          onPress={onClose}
          variant="ghost"
          size="md"
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
