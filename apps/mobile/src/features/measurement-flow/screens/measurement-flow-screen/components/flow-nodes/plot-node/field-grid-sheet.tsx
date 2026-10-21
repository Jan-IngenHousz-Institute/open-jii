import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ExampleLayout, LayoutSession, NextPlot } from "./next-plot";
import { PlotGrid } from "./plot-grid";
import { PlotStateCell } from "./plot-state-cell";
import { PlotStateLegend } from "./plot-state-legend";
import type { PlotLegendEntry } from "./plot-state-legend";

const LEGEND_ENTRIES: PlotLegendEntry[] = ["current", "measured", "skipped", "otherShare", "gap"];

interface FieldGridSheetProps {
  layout: ExampleLayout;
  session: LayoutSession;
  experimentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FieldGridSheet({
  layout,
  session,
  experimentName,
  isOpen,
  onClose,
}: FieldGridSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });

  const { field, namedPlot, share } = layout;
  const skippedPlots = session.skipped.map((plot) => plot.identifier).join(", ");
  const shareEdge = Math.max(
    ...field.plots.filter((plot) => share.isInShare(plot.identifier)).map((plot) => plot.column),
  );

  const renderCell = (plot: NextPlot) => (
    <PlotStateCell
      identifier={plot.identifier}
      state={session.stateOf(plot.identifier)}
      isCurrent={plot.identifier === namedPlot.identifier}
      isOtherShare={!share.isInShare(plot.identifier)}
    />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["100%"]}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      topInset={insets.top}
      stackBehavior="push"
    >
      <View className="border-border border-b px-4 pb-4 pt-2">
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 22 }}>
          {t("measurementFlow:fieldGrid.title")}
        </Text>
        <Text className="text-muted-body mt-0.5 text-[13.5px]" numberOfLines={1}>
          {experimentName}
        </Text>
      </View>

      <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="bg-gray-background gap-1 rounded-xl p-4">
          <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
            {t("measurementFlow:fieldGrid.measuredCount", {
              measured: session.measured.length,
              total: session.total,
            })}
          </Text>
          <Text className="text-muted-body text-sm">
            {t("measurementFlow:fieldGrid.remaining", {
              skipped: session.skipped.length,
              toMeasure: share.toDo.length,
            })}
          </Text>
        </View>

        <PlotGrid field={field} renderCell={renderCell} focusColumn={shareEdge} />
        <PlotStateLegend entries={LEGEND_ENTRIES} otherMeasurer={share.otherMeasurer} />

        <View className="gap-1">
          <Text className="text-muted-body text-sm">
            {t("measurementFlow:fieldGrid.skipped", { plots: skippedPlots })}
          </Text>
          <Text className="text-on-surface text-[15px] font-bold">
            {t("measurementFlow:fieldGrid.current", { plot: namedPlot.identifier })}
          </Text>
          <Text className="text-muted-body text-sm">
            {t("measurementFlow:plotNode.walkNext", { plots: share.walk.after(3).join(", ") })}
          </Text>
        </View>
      </BottomSheetScrollView>

      <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button title={t("measurementFlow:fieldGrid.back")} onPress={onClose} size="lg" />
      </View>
    </BottomSheetModal>
  );
}
