import { ChevronRight, MapPin, Repeat2 } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Tag } from "~/shared/ui/Tag";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { usePlotStepStore } from "./next-plot";
import { isTreatmentShown } from "./scaffold-screen";

/**
 * The plot confirmed on the Next plot step, kept on every later step of the round. Until the reading
 * is accepted, tapping it reopens the plot picker to correct the plot.
 */
export function ConfirmedPlotCard() {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const confirmedRound = usePlotStepStore((s) => s.confirmedRound);
  const plot = usePlotStepStore((s) => s.confirmedPlot);
  const repeat = usePlotStepStore((s) => s.repeat);
  const openPicker = usePlotStepStore((s) => s.openPicker);

  const isConfirmedThisRound = confirmedRound === iterationCount;
  const isRepeat = repeat > 1;

  if (!isConfirmedThisRound || !plot) {
    return null;
  }

  return (
    <Pressable
      onPress={openPicker}
      accessibilityRole="button"
      accessibilityHint={t("measurementFlow:confirmedPlot.changeHint")}
      className="bg-gray-background flex-row items-center gap-3 rounded-xl p-3 active:opacity-60"
    >
      <View className="bg-jii-mint h-10 w-10 items-center justify-center rounded-xl">
        <MapPin size={18} color={colors.jii.darkGreen} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground text-lg font-bold">{plot.identifier}</Text>
          {isRepeat ? (
            <Tag
              variant="both"
              size="sm"
              icon={<Repeat2 size={12} color={colors.jii.darkerGreen} />}
            >
              {t("measurementFlow:confirmedPlot.repeat", { repeat })}
            </Tag>
          ) : null}
        </View>
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:confirmedPlot.place", {
            row: plot.rowLabel,
            column: plot.column,
            block: plot.block,
          })}
        </Text>
        {isTreatmentShown() ? (
          <Text className="text-muted-foreground text-sm">
            {t("measurementFlow:confirmedPlot.attributes", {
              treatment: plot.treatment,
              genotype: plot.genotype,
            })}
          </Text>
        ) : null}
      </View>
      <Text className="text-sm font-semibold" style={{ color: themeColors.brand }}>
        {t("measurementFlow:confirmedPlot.change")}
      </Text>
      <ChevronRight size={18} color={themeColors.brand} />
    </Pressable>
  );
}
