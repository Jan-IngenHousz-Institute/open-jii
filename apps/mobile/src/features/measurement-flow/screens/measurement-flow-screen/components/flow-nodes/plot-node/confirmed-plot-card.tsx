import { MapPin } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";

import { usePlotStepStore } from "./next-plot";
import { isScaffoldScreenOn } from "./scaffold-screen";

/** The plot confirmed on the Next plot step, kept above the round's later steps. */
export function ConfirmedPlotCard() {
  const { t } = useTranslation("measurementFlow");
  const iterationCount = useMeasurementFlowStore((s) => s.iterationCount);
  const confirmedRound = usePlotStepStore((s) => s.confirmedRound);
  const plot = usePlotStepStore((s) => s.confirmedPlot);

  const isCardOn = isScaffoldScreenOn("d6-questions-only-plot");
  const isConfirmedThisRound = confirmedRound === iterationCount;

  if (!isCardOn || !isConfirmedThisRound || !plot) {
    return null;
  }

  return (
    <View className="bg-gray-background flex-row items-center gap-3 rounded-xl p-3">
      <View className="bg-jii-mint h-10 w-10 items-center justify-center rounded-xl">
        <MapPin size={18} color={colors.jii.darkGreen} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-foreground text-lg font-bold">{plot.identifier}</Text>
          <Text className="text-muted-foreground text-sm">
            {t("measurementFlow:plotNode.position", { row: plot.rowLabel, column: plot.column })}
          </Text>
        </View>
        <Text className="text-muted-foreground text-sm">
          {t("measurementFlow:confirmedPlot.attributes", {
            treatment: plot.treatment,
            genotype: plot.genotype,
          })}
        </Text>
      </View>
    </View>
  );
}
