import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import { FieldGridCell } from "./field-grid-cell";
import type { ExampleLayout, NextPlot } from "./next-plot";
import { PlotGrid } from "./plot-grid";
import { PlotGridLegend } from "./plot-grid-legend";
import type { PlotGridLegendItem } from "./plot-grid-legend";

interface FieldGridSheetProps {
  layout: ExampleLayout;
  experimentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FieldGridSheet({ layout, experimentName, isOpen, onClose }: FieldGridSheetProps) {
  const { t } = useTranslation("measurementFlow");
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { sheetRef, renderBackdrop } = useBottomSheetController({ visible: isOpen });

  const { field, namedPlot, share } = layout;

  const legendItems: PlotGridLegendItem[] = [
    {
      label: t("measurementFlow:fieldGrid.legendDone"),
      swatchClassName: "border-success border-2",
    },
    {
      label: t("measurementFlow:fieldGrid.legendSkipped"),
      swatchClassName: "border-warning border-2 border-dashed",
    },
    {
      label: t("measurementFlow:fieldGrid.legendCurrent"),
      swatchClassName: "border-jii-darker-green border-[3px]",
    },
    {
      label: t("measurementFlow:fieldGrid.legendOtherShare", { name: share.otherMeasurer }),
      swatchClassName: "bg-badge-published opacity-30",
    },
  ];

  const renderCell = (plot: NextPlot) => (
    <FieldGridCell plot={plot} state={share.stateOf(plot.identifier)} />
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
          <View className="flex-row items-baseline gap-2">
            <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 26 }}>
              {t("measurementFlow:fieldGrid.doneCount", {
                done: share.done.length,
                total: share.walk.total,
              })}
            </Text>
            <Text className="text-muted-body text-sm">
              {t("measurementFlow:fieldGrid.doneLabel")}
            </Text>
          </View>
          <Text className="text-muted-body text-sm">
            {t("measurementFlow:fieldGrid.remaining", {
              skipped: share.skipped.length,
              toDo: share.toDo.length,
            })}
          </Text>
        </View>

        <PlotGrid field={field} renderCell={renderCell} />
        <PlotGridLegend items={legendItems} />

        <View className="gap-1">
          <Text className="text-on-surface text-[15px] font-bold">
            {t("measurementFlow:fieldGrid.current", {
              plot: namedPlot.identifier,
              treatment: namedPlot.treatment,
            })}
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
