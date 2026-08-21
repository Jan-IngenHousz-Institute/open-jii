import { clsx } from "clsx";
import React from "react";
import { View, Text } from "react-native";
import { useMacroOutputs } from "~/features/measurement-flow/hooks/use-macro-outputs";
import { useTranslation } from "~/shared/i18n";
import type { ResolvedMacro } from "~/shared/measurements/flow-node";
import type { MacroOutput } from "~/shared/measurements/macro-output";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { MeasurementResult } from "~/shared/ui/measurement/measurement-result";

interface AnalysisMacroResultProps {
  macro: ResolvedMacro | undefined;
  isLoading: boolean;
  macroId: string;
  scanResult: object | undefined;
  /** Upstream cell outputs the macro reads as `ctx.<name>`. */
  ctx?: Record<string, unknown>;
  /** Upstream normalization failure surfaced by MeasurementResult. */
  inputError?: Error;
  /** Called with the macro outputs once computed, so the flow can persist them. */
  onProcessed?: (outputs: MacroOutput[]) => void;
  onCommentPress: () => void;
}

export function AnalysisMacroResult({
  macro,
  isLoading,
  macroId,
  scanResult,
  ctx,
  inputError,
  onProcessed,
  onCommentPress,
}: AnalysisMacroResultProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const {
    outputs,
    isLoading: isRunning,
    error,
  } = useMacroOutputs({
    rawMeasurement: scanResult,
    macro,
    ctx,
    inputError,
    onProcessed,
  });

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
      outputs={outputs}
      isLoading={isRunning}
      error={error}
      onCommentPress={onCommentPress}
    />
  );
}
