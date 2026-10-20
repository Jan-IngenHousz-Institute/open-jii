import { clsx } from "clsx";
import { MapPin } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";

import type { ExampleField, NextPlot } from "./next-plot";
import { PlotGrid } from "./plot-grid";
import { PlotGridLegend } from "./plot-grid-legend";
import type { PlotGridLegendItem } from "./plot-grid-legend";
import { PlotPickerCell } from "./plot-picker-cell";

interface PlotPickerProps {
  field: ExampleField;
  namedPlot: NextPlot;
  measured: string[];
  heldPlot: string | null;
  onPick: (plot: NextPlot) => void;
  onCancel: () => void;
}

export function PlotPicker({
  field,
  namedPlot,
  measured,
  heldPlot,
  onPick,
  onCancel,
}: PlotPickerProps) {
  const { t } = useTranslation("measurementFlow");
  const [pressedPlot, setPressedPlot] = useState(heldPlot);
  const isPicking = pressedPlot !== null;

  const legendItems: PlotGridLegendItem[] = [
    {
      label: t("measurementFlow:plotPicker.namedPlot"),
      swatchClassName: "bg-primary/10 border-primary border-2",
      icon: <MapPin size={8} color={colors.jii.darkGreen} />,
    },
    {
      label: t("measurementFlow:plotPicker.measured"),
      swatchClassName: "bg-primary/5 border-primary/20 border opacity-40",
    },
  ];

  const releasePress = () => setPressedPlot(null);

  const renderCell = (plot: NextPlot) => (
    <PlotPickerCell
      plot={plot}
      isNamed={plot.identifier === namedPlot.identifier}
      isMeasured={measured.includes(plot.identifier)}
      isPressed={plot.identifier === pressedPlot}
      onPressIn={setPressedPlot}
      onPressOut={releasePress}
      onPick={onPick}
    />
  );

  return (
    <View className="flex-1 gap-3 px-4 pt-4">
      <View className="gap-1">
        <Text className="text-foreground text-lg font-bold">
          {t("measurementFlow:plotPicker.title")}
        </Text>
        <Text
          className={clsx(
            "text-sm",
            isPicking ? "text-primary font-semibold" : "text-muted-foreground",
          )}
        >
          {isPicking
            ? t("measurementFlow:plotPicker.picked", { plot: pressedPlot })
            : t("measurementFlow:plotPicker.hint")}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
        <PlotGrid field={field} renderCell={renderCell} />
        <PlotGridLegend items={legendItems} />
      </ScrollView>

      <View className="pb-4">
        <Button title={t("measurementFlow:plotPicker.cancel")} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
