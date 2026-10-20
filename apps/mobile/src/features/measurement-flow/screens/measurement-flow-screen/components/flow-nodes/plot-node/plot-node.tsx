import { LayoutGrid, MapPin } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ExampleWalk, NextPlot } from "./next-plot";
import { PlotWalkLine } from "./plot-walk-line";

interface PlotNodeProps {
  plot: NextPlot;
  walk?: ExampleWalk;
  onConfirm: () => void;
  onReject: () => void;
  onSkip?: () => void;
  onShowFieldGrid?: () => void;
}

export function PlotNode({
  plot,
  walk,
  onConfirm,
  onReject,
  onSkip,
  onShowFieldGrid,
}: PlotNodeProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();

  const renderAttribute = ([label, value]: [string, string]) => (
    <View key={label} className="flex-row justify-between">
      <Text className="text-muted-foreground text-base">{label}</Text>
      <Text className="text-foreground text-base font-semibold">{value}</Text>
    </View>
  );

  const attributes: [string, string][] = [
    [t("measurementFlow:plotNode.treatment"), plot.treatment],
    [t("measurementFlow:plotNode.block"), plot.block],
    [t("measurementFlow:plotNode.genotype"), plot.genotype],
  ];

  return (
    <View className="flex-1 gap-4 px-4 pt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-foreground text-lg font-bold">
          {t("measurementFlow:plotNode.title")}
        </Text>
        {onShowFieldGrid ? (
          <Button
            title={t("measurementFlow:plotNode.showFieldGrid")}
            variant="ghost"
            size="sm"
            icon={<LayoutGrid size={16} color={themeColors.brand} />}
            onPress={onShowFieldGrid}
          />
        ) : null}
      </View>

      <View className="bg-gray-background gap-3 rounded-xl p-4">
        <View className="flex-row items-center gap-2">
          <MapPin size={20} color={themeColors.onSurface} />
          <Text className="text-foreground text-3xl font-bold">{plot.identifier}</Text>
        </View>
        {walk ? <PlotWalkLine walk={walk} /> : null}
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:plotNode.position", { row: plot.rowLabel, column: plot.column })}
        </Text>
        <View className="gap-2">{attributes.map(renderAttribute)}</View>
      </View>

      <Text className="text-muted-foreground text-sm">{t("measurementFlow:plotNode.hint")}</Text>

      <View className="mt-auto gap-3 pb-4">
        <Button title={t("measurementFlow:plotNode.confirm")} onPress={onConfirm} />
        <Button title={t("measurementFlow:plotNode.reject")} variant="outline" onPress={onReject} />
        {onSkip ? (
          <Button title={t("measurementFlow:plotNode.skip")} variant="ghost" onPress={onSkip} />
        ) : null}
      </View>
    </View>
  );
}
