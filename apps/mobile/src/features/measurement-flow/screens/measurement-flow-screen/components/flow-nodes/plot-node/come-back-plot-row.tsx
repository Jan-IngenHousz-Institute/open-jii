import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

import type { SkipReason, SkippedPlot } from "./next-plot";
import { PlotMarkGlyph } from "./plot-mark-glyph";

interface ComeBackPlotRowProps {
  plot: SkippedPlot;
  onMeasure: (identifier: string) => void;
}

export function ComeBackPlotRow({ plot, onMeasure }: ComeBackPlotRowProps) {
  const { t } = useTranslation("measurementFlow");

  const reasonLabels: Record<SkipReason, string> = {
    plantMissing: t("measurementFlow:skipSheet.plantMissing"),
    flooded: t("measurementFlow:skipSheet.flooded"),
    couldNotReach: t("measurementFlow:skipSheet.couldNotReach"),
    other: t("measurementFlow:skipSheet.other"),
  };

  const handleMeasure = () => onMeasure(plot.identifier);

  return (
    <View className="border-border bg-card flex-row items-center gap-3 rounded-2xl border p-3.5">
      <View className="bg-gray-background h-10 w-10 items-center justify-center rounded-xl">
        <PlotMarkGlyph mark="skipped" size={20} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-on-surface text-[17px] font-bold">{plot.identifier}</Text>
        <Text className="text-muted-body text-[13px]">
          {t("measurementFlow:comeBack.reason", {
            reason: reasonLabels[plot.reason],
            time: plot.skippedAt,
          })}
        </Text>
      </View>
      <Button
        title={t("measurementFlow:comeBack.measure", { plot: plot.identifier })}
        onPress={handleMeasure}
        variant="outline"
        size="md"
      />
    </View>
  );
}
