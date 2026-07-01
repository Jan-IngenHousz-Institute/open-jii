import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { MeasurementResult } from "~/features/measurement-flow/components/measurement-result/measurement-result";
import type { MacroOutput } from "~/features/measurement-flow/utils/process-scan/process-scan";
import { useTranslation } from "~/shared/i18n";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import type { Macro } from "@repo/api/schemas/macro.schema";

interface AnalysisMacroResultProps {
  macro: Macro | undefined;
  isLoading: boolean;
  macroId: string;
  scanResult: object;
  ctx?: Record<string, unknown>;
  onProcessed?: (outputs: MacroOutput[]) => void;
  onCommentPress: () => void;
}

export function AnalysisMacroResult({
  macro,
  isLoading,
  macroId,
  scanResult,
  ctx,
  onProcessed,
  onCommentPress,
}: AnalysisMacroResultProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  if (!scanResult) {
    return (
      <View className="items-center py-8">
        <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
          {t("measurementFlow:analysis.macroResult.noDataTitle")}
        </Text>
        <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
          {t("measurementFlow:analysis.macroResult.noDataMessage")}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
          {t("measurementFlow:analysis.macroResult.loadingMacro")}
        </Text>
      </View>
    );
  }

  if (!macro) {
    return (
      <View className="items-center py-8">
        <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
          {t("measurementFlow:analysis.macroResult.macroNotFound")}
        </Text>
        <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
          {t("measurementFlow:analysis.macroResult.macroIdLabel", { macroId })}
        </Text>
      </View>
    );
  }

  return (
    <MeasurementResult
      rawMeasurement={scanResult}
      macro={macro}
      ctx={ctx}
      onProcessed={onProcessed}
      onCommentPress={onCommentPress}
    />
  );
}
