import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { useState } from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

interface AddPlotSheetProps {
  isOpen: boolean;
  onAdd: (name: string, genotype: string | undefined) => void;
  onClose: () => void;
}

/** Adds a plot the layout does not list, which waits on the web for someone to place it. */
export function AddPlotSheet({ isOpen, onAdd, onClose }: AddPlotSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });
  const [name, setName] = useState("");
  const [genotype, setGenotype] = useState("");

  const trimmedName = name.trim();
  const hasName = trimmedName.length > 0;

  const handleAdd = () => onAdd(trimmedName, genotype.trim() || undefined);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      stackBehavior="push"
    >
      <BottomSheetView className="bg-card gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
          {t("measurementFlow:addPlot.title")}
        </Text>
        <Text className="text-muted-body text-[13.5px] leading-5">
          {t("measurementFlow:addPlot.body")}
        </Text>

        <Input
          asBottomSheet
          label={t("measurementFlow:addPlot.name")}
          placeholder={t("measurementFlow:addPlot.namePlaceholder")}
          value={name}
          onChangeText={setName}
          autoCapitalize="characters"
          autoCorrect={false}
          containerStyle={{ marginBottom: 0 }}
        />
        <Input
          asBottomSheet
          label={t("measurementFlow:addPlot.genotype")}
          placeholder={t("measurementFlow:addPlot.genotypePlaceholder")}
          value={genotype}
          onChangeText={setGenotype}
          containerStyle={{ marginBottom: 4 }}
        />

        <Button
          title={
            hasName
              ? t("measurementFlow:addPlot.add", { plot: trimmedName })
              : t("measurementFlow:addPlot.nameFirst")
          }
          onPress={handleAdd}
          isDisabled={!hasName}
          size="lg"
        />
        <Button title={t("measurementFlow:addPlot.cancel")} onPress={onClose} variant="ghost" />
      </BottomSheetView>
    </BottomSheetModal>
  );
}
