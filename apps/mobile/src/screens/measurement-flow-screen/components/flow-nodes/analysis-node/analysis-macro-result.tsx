import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { MeasurementResult } from "~/components/measurement-result/measurement-result";
import { useTheme } from "~/hooks/use-theme";

import type { Macro } from "@repo/api/schemas/macro.schema";

interface AnalysisMacroResultProps {
  macro: Macro | undefined;
  isLoading: boolean;
  macroId: string;
  scanResult: object;
  onCommentPress: () => void;
}

export function AnalysisMacroResult({
  macro,
  isLoading,
  macroId,
  scanResult,
  onCommentPress,
}: AnalysisMacroResultProps) {
  const { classes } = useTheme();

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

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
          Loading Macro...
        </Text>
      </View>
    );
  }

  if (!macro) {
    return (
      <View className="items-center py-8">
        <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
          Macro Not Found
        </Text>
        <Text className={clsx("mb-6 text-center", classes.textSecondary)}>Macro ID: {macroId}</Text>
      </View>
    );
  }

  return (
    <MeasurementResult rawMeasurement={scanResult} macro={macro} onCommentPress={onCommentPress} />
  );
}
