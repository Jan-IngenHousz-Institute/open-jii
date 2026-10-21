import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";

import { PlotHatch } from "./plot-hatch";
import { PlotMarkGlyph } from "./plot-mark-glyph";

export type PlotLegendEntry = "current" | "measured" | "skipped" | "otherShare" | "gap";

interface PlotStateLegendProps {
  entries: PlotLegendEntry[];
  /** Names the share the hatch marks, such as Alex Example. */
  otherMeasurer?: string;
}

/** The shared plot-state legend, drawn the same under every grid on the phone. */
export function PlotStateLegend({ entries, otherMeasurer }: PlotStateLegendProps) {
  const { t } = useTranslation("measurementFlow");

  const swatchOf = (entry: PlotLegendEntry) => {
    switch (entry) {
      case "current":
      case "measured":
      case "skipped":
        return <PlotMarkGlyph mark={entry} />;
      case "otherShare":
        return (
          <View className="bg-muted/50 border-foreground/15 h-4 w-4 overflow-hidden rounded border">
            <PlotHatch />
          </View>
        );
      case "gap":
        return (
          <View
            className="border-muted-foreground/40 h-4 w-4 rounded"
            style={{ borderWidth: 1.5, borderStyle: "dotted" }}
          />
        );
    }
  };

  const labelOf = (entry: PlotLegendEntry) => {
    switch (entry) {
      case "current":
        return t("measurementFlow:plotLegend.current");
      case "measured":
        return t("measurementFlow:plotLegend.measured");
      case "skipped":
        return t("measurementFlow:plotLegend.skipped");
      case "otherShare":
        return otherMeasurer
          ? t("measurementFlow:plotLegend.namedShare", { name: otherMeasurer })
          : t("measurementFlow:plotLegend.otherShare");
      case "gap":
        return t("measurementFlow:plotLegend.gap");
    }
  };

  const renderEntry = (entry: PlotLegendEntry) => (
    <View key={entry} className="flex-row items-center gap-1.5">
      {swatchOf(entry)}
      <Text className="text-muted-foreground text-xs">{labelOf(entry)}</Text>
    </View>
  );

  return <View className="flex-row flex-wrap gap-x-4 gap-y-2">{entries.map(renderEntry)}</View>;
}
