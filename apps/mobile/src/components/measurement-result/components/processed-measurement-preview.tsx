import { clsx } from "clsx";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { Chart } from "./chart";
import { KeyValue } from "./key-value";
import { MeasurementHeader } from "./measurement-header";

interface ProcessedMeasurementPreviewProps {
  output: any[];
  timestamp?: string;
  onClose: () => void;
  experimentName?: string;
}

export function ProcessedMeasurementPreview({
  output: outputs,
  timestamp,
  onClose,
  experimentName,
}: ProcessedMeasurementPreviewProps) {
  const { classes } = useTheme();

  if (!outputs || outputs.length === 0) {
    return (
      <View className={clsx("flex-1", classes.background)}>
        <MeasurementHeader
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={onClose}
        />
        <View className="flex-1 items-center justify-center p-6">
          <Text className={clsx("text-center text-lg", classes.textSecondary)}>
            No Data Available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className={clsx("flex-1", classes.background)}>
      <MeasurementHeader timestamp={timestamp} experimentName={experimentName} onClose={onClose} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={true}>
        <View className="p-4">
          {outputs.map((output, outputIndex) =>
            Object.keys(output).map((key) => {
              const value = output[key];
              if (typeof value === "string" || typeof value === "number") {
                return <KeyValue key={`${outputIndex}-${key}`} value={value} name={key} />;
              }
              if (Array.isArray(value) && typeof value[0] === "number") {
                return <Chart key={`${outputIndex}-${key}`} name={key} values={value} />;
              }
              return null;
            }),
          )}
        </View>
      </ScrollView>
    </View>
  );
}
