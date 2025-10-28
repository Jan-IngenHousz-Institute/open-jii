import { clsx } from "clsx";
import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { MeasurementResult } from "~/components/measurement-result";
import { useMacros } from "~/hooks/use-macros";
import { useTheme } from "~/hooks/use-theme";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { processScan } from "~/utils/process-scan/process-scan";

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
  const [processedResult, setProcessedResult] = React.useState<any>(null);
  const [processingError, setProcessingError] = React.useState<string | null>(null);

  const macro = macros?.find((m) => m.value === content.macroId);

  // Process the scan result with the macro when scanResult changes
  React.useEffect(() => {
    if (!macro || !scanResult) {
      setProcessingError(null);
      setProcessedResult(null);
      return;
    }

    console.log("executing use effect");
    setProcessingError(null); // Clear previous errors

    try {
      const processed = processScan(
        scanResult,
        undefined, // userId - not needed for analysis
        macro.filename,
        macro.code,
        (errorMessage) => {
          console.error("Macro processing error:", errorMessage);
          setProcessingError(errorMessage);
        },
      );
      setProcessedResult(processed);
    } catch (error) {
      console.error("Error processing scan result with macro:", error);
      setProcessingError(error instanceof Error ? error.message : "Unknown processing error");
    }
  }, [scanResult, JSON.stringify(macro)]);

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

    if (processingError) {
      return (
        <View className="items-center py-8">
          <Text
            className={clsx(
              "mb-4 text-center text-lg font-semibold text-red-600 dark:text-red-400",
              classes.text,
            )}
          >
            Analysis Failed
          </Text>
          <Text
            className={clsx(
              "mb-6 text-center text-red-500 dark:text-red-400",
              classes.textSecondary,
            )}
          >
            {processingError}
          </Text>
          <Text className={clsx("text-center text-sm", classes.textSecondary)}>
            Macro: {macro?.label ?? "Unknown"}
          </Text>
        </View>
      );
    }

    if (!processedResult) {
      return (
        <View className="items-center py-8">
          <Text className={clsx("mb-4 text-center text-lg font-semibold", classes.text)}>
            Processing Analysis...
          </Text>
          <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
            Applying macro: {macro?.label ?? "Unknown"}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ height: 400 }}>
        <MeasurementResult
          data={processedResult}
          timestamp={processedResult?.timestamp}
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
