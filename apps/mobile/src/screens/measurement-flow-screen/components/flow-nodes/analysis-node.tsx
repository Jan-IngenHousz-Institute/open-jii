import { clsx } from "clsx";
import React, { useRef } from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementResult } from "~/components/measurement-result/measurement-result";
import { useExperiment } from "~/hooks/use-experiment";
import { useMacro } from "~/hooks/use-macro";
import { useProtocol } from "~/hooks/use-protocol";
import { useSessionStore } from "~/hooks/use-session-store";
import { useTheme } from "~/hooks/use-theme";
import { useUpload } from "~/hooks/use-upload";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";

interface AnalysisNodeProps {
  content: {
    params: Record<string, any>;
    macroId: string;
  };
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes } = useTheme();
  const { macro, isLoading } = useMacro(content.macroId);
  const { scanResult, previousStep, nextStep, experimentId } = useMeasurementFlowStore();
  const { experiment } = useExperiment(experimentId);
  const { protocol } = useProtocol(content?.params?.protocolId);
  const { session } = useSessionStore();
  const experimentName = experiment?.name ?? "Experiment";

  const analysisTimestampRef = useRef<string>(new Date().toISOString());

  const { isUploading, uploadMeasurement } = useUpload();

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
          <Text className={clsx("mb-6 text-center", classes.textSecondary)}>
            Macro ID: {content.macroId}
          </Text>
        </View>
      );
    }

    return (
      <MeasurementResult
        rawMeasurement={scanResult}
        macro={macro}
        timestamp={analysisTimestampRef.current}
        experimentName={experimentName}
      />
    );
  };

  const handleUploadMeasurement = async () => {
    if (!scanResult) {
      return;
    }

    if (!experimentId) {
      throw new Error("Missing experiment id");
    }
    if (!protocol?.name) {
      throw new Error("Missing protocol name");
    }

    if (!session?.data?.user?.id) {
      throw new Error("Missing user id");
    }

    if (!macro?.filename) {
      throw new Error("Missing macro filename");
    }

    await uploadMeasurement({
      rawMeasurement: scanResult,
      timestamp: analysisTimestampRef.current,
      experimentName,
      experimentId: experimentId,
      protocolName: protocol?.name,
      userId: session?.data?.user?.id,
      macroFilename: macro?.filename,
    });
    nextStep();
  };

  const handleRetry = () => {
    previousStep();
  };

  return (
    <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
      <View className="border-b border-gray-200 p-4 dark:border-gray-700">
        <Text className={clsx("text-lg font-semibold", classes.text)}>Analysis</Text>
      </View>
      <View className="flex-1 p-4">{renderContent()}</View>
      <View className="border-t border-gray-200 p-4 dark:border-gray-700">
        <View className="flex-row gap-3">
          <Button
            title="Retry"
            onPress={handleRetry}
            variant="outline"
            style={{ flex: 1 }}
            textStyle={{ color: "#ef4444" }}
          />
          <Button
            title={isUploading ? "Uploading..." : "Upload"}
            onPress={handleUploadMeasurement}
            disabled={isUploading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}
