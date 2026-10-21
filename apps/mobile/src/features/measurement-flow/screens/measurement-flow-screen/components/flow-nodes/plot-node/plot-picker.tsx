import { ScanLine, Search } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ExampleField, LayoutSession, NextPlot } from "./next-plot";
import { PlotGrid } from "./plot-grid";
import { PlotStateCell } from "./plot-state-cell";
import { PlotStateLegend } from "./plot-state-legend";
import type { PlotLegendEntry } from "./plot-state-legend";

interface PlotPickerProps {
  field: ExampleField;
  namedPlot: NextPlot;
  session: LayoutSession;
  selectedPlot: string | null;
  onSelect: (identifier: string) => void;
  onMeasure: (plot: NextPlot) => void;
  onCancel: () => void;
}

export function PlotPicker({
  field,
  namedPlot,
  session,
  selectedPlot,
  onSelect,
  onMeasure,
  onCancel,
}: PlotPickerProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const [search, setSearch] = useState("");

  const selected = field.plots.find((plot) => plot.identifier === selectedPlot);
  const hasSkippedPlots = session.skipped.length > 0;

  const legendEntries: PlotLegendEntry[] = hasSkippedPlots
    ? ["current", "measured", "skipped", "gap"]
    : ["current", "measured", "gap"];

  const selectSearched = () => {
    const match = field.plots.find(
      (plot) => plot.identifier.toLowerCase() === search.trim().toLowerCase(),
    );
    if (match) {
      onSelect(match.identifier);
    }
  };

  const measureSelected = () => {
    if (selected) {
      onMeasure(selected);
    }
  };

  const renderCell = (plot: NextPlot) => (
    <PlotStateCell
      identifier={plot.identifier}
      state={session.stateOf(plot.identifier)}
      isCurrent={plot.identifier === namedPlot.identifier}
      isSelected={plot.identifier === selectedPlot}
      onPress={onSelect}
    />
  );

  return (
    <View className="flex-1 gap-3 px-4 pt-4">
      <Text className="text-foreground text-lg font-bold">
        {t("measurementFlow:plotPicker.title")}
      </Text>

      <View className="flex-row items-center gap-2">
        <Input
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={selectSearched}
          placeholder={t("measurementFlow:plotPicker.searchPlaceholder")}
          leftIcon={<Search size={18} color={themeColors.inactive} />}
          containerStyle={{ flex: 1, marginBottom: 0 }}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button
          title={t("measurementFlow:plotPicker.scanLabel")}
          variant="outline"
          size="md"
          icon={<ScanLine size={18} color={themeColors.brand} />}
        />
      </View>

      <Text className="text-muted-foreground text-sm">
        {selected
          ? t("measurementFlow:plotPicker.selected", {
              plot: selected.identifier,
              row: selected.rowLabel,
              column: selected.column,
            })
          : t("measurementFlow:plotPicker.hint")}
      </Text>

      <ScrollView className="flex-1" contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
        <PlotGrid field={field} renderCell={renderCell} focusColumn={namedPlot.column} />
        <PlotStateLegend entries={legendEntries} />
      </ScrollView>

      <View className="gap-2 pb-4">
        <Button
          title={
            selected
              ? t("measurementFlow:plotPicker.measure", { plot: selected.identifier })
              : t("measurementFlow:plotPicker.pickFirst")
          }
          size="lg"
          isDisabled={!selected}
          onPress={measureSelected}
        />
        <Button title={t("measurementFlow:plotPicker.cancel")} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
