import { Ban, LayoutGrid, MapPin, MapPinned } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { ComeBackRow } from "./come-back-row";
import type { ExampleWalk, LayoutSession, NextPlot } from "./next-plot";
import { PlotWalkLine } from "./plot-walk-line";

interface PlotNodeProps {
  plot: NextPlot;
  session: LayoutSession;
  isTreatmentShown: boolean;
  walk?: ExampleWalk;
  onMeasure: () => void;
  onAtAnotherPlot: () => void;
  onCannotMeasure?: () => void;
  onComeBack?: () => void;
  onShowFieldGrid?: () => void;
}

/** The Next plot step: the plot to walk to, one action to measure it and the ways out. */
export function PlotNode({
  plot,
  session,
  isTreatmentShown,
  walk,
  onMeasure,
  onAtAnotherPlot,
  onCannotMeasure,
  onComeBack,
  onShowFieldGrid,
}: PlotNodeProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();

  const isFirstRound = session.measured.length === 0;
  const hasComeBackPlots = session.skipped.length > 0 && onComeBack !== undefined;

  const attributes: [string, string][] = [[t("measurementFlow:plotNode.block"), plot.block]];
  if (isTreatmentShown) {
    attributes.push(
      [t("measurementFlow:plotNode.treatment"), plot.treatment],
      [t("measurementFlow:plotNode.genotype"), plot.genotype],
    );
  }

  const renderAttribute = ([label, value]: [string, string]) => (
    <View key={label} className="flex-row justify-between">
      <Text className="text-muted-foreground text-base">{label}</Text>
      <Text className="text-foreground text-base font-semibold">{value}</Text>
    </View>
  );

  return (
    <View className="flex-1 gap-4 px-4 pt-4">
      <Text className="text-foreground text-lg font-bold">
        {t("measurementFlow:plotNode.title")}
      </Text>

      <View className="bg-gray-background gap-3 rounded-xl p-4">
        <View className="flex-row items-center gap-2">
          <MapPin size={22} color={themeColors.onSurface} />
          <Text className="text-foreground text-4xl font-bold">{plot.identifier}</Text>
        </View>
        {walk ? <PlotWalkLine walk={walk} /> : null}
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:plotNode.position", { row: plot.rowLabel, column: plot.column })}
        </Text>
        <View className="gap-2">{attributes.map(renderAttribute)}</View>
      </View>

      {hasComeBackPlots && onComeBack ? (
        <ComeBackRow skipped={session.skipped} onPress={onComeBack} />
      ) : null}

      {isFirstRound ? (
        <Text className="text-muted-foreground text-sm">{t("measurementFlow:plotNode.hint")}</Text>
      ) : null}

      <View className="mt-auto gap-3 pb-4">
        <Button
          title={t("measurementFlow:plotNode.measure", { plot: plot.identifier })}
          onPress={onMeasure}
          size="lg"
        />
        <Button
          title={t("measurementFlow:plotNode.atAnotherPlot")}
          variant="outline"
          size="lg"
          icon={<MapPinned size={18} color={themeColors.brand} />}
          onPress={onAtAnotherPlot}
        />
        {onCannotMeasure ? (
          <Button
            title={t("measurementFlow:plotNode.cannotMeasure")}
            variant="outline"
            size="lg"
            icon={<Ban size={18} color={themeColors.brand} />}
            onPress={onCannotMeasure}
          />
        ) : null}
        {onShowFieldGrid ? (
          <Button
            title={t("measurementFlow:plotNode.showFieldGrid")}
            variant="outline"
            size="lg"
            icon={<LayoutGrid size={18} color={themeColors.brand} />}
            onPress={onShowFieldGrid}
          />
        ) : null}
      </View>
    </View>
  );
}
