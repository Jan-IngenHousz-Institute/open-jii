import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { MeasurementResult } from "~/components/measurement-result";
import { useMacros } from "~/hooks/use-macros";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

interface AnalysisNodeProps {
  content: {
    params: Record<string, unknown>;
    macroId: string;
  };
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes } = useTheme();
  const { macros } = useMacros();
  const { scanResult } = useMeasurementFlowStore();

  const macro = macros?.find((m) => m.value === content.macroId);

  const renderContent = () => {
    if (!scanResult) {
      return (
        <View className="items-center py-8">
          <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
            No Measurement Data
          </Text>
          <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
            Please complete the measurement step first
          </Text>
        </View>
      );
    }

    return (
      <View style={{ height: 400 }}>
        <MeasurementResult
          data={scanResult}
          timestamp={scanResult?.timestamp}
          experimentName={macro?.label ?? "Analysis"}
        />
      </View>
    );
  };

  return (
    <View className={clsx("rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Analysis</Text>
      </View>

      <View className="p-4">{renderContent()}</View>
    </View>
  );
}
