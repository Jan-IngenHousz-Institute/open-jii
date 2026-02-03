import { clsx } from "clsx";
import React, { useRef, useState } from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementResult } from "~/components/measurement-result/measurement-result";
import { useExperiments } from "~/hooks/use-experiments";
import { useMacro } from "~/hooks/use-macro";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";

import { RecentMeasurementsInFlow } from "../recent-measurements-in-flow";

interface AnalysisNodeProps {
  content: {
    params: Record<string, any>;
    macroId: string;
  };
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes } = useTheme();
  const { macro, isLoading } = useMacro(content.macroId);
  const {
    scanResult,
    previousStep,
    experimentId,
    protocolId,
    finishFlow,
    iterationCount,
    flowNodes,
    resetFlow,
    nextStep,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const [showRecentMeasurements, setShowRecentMeasurements] = useState(false);

  const experimentName =
    experiments.find((experiment) => experiment.value === experimentId)?.label ?? "Experiment";

  const analysisTimestampRef = useRef<string>(new Date().toISOString());
  const { getCycleAnswers } = useFlowAnswersStore();

  const { isUploading, uploadMeasurement } = useMeasurementUpload();

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

    if (!protocolId) {
      throw new Error("Missing protocol name");
    }

    if (!session?.data?.user?.id) {
      throw new Error("Missing user id");
    }

    if (!macro?.id || !macro?.name || !macro?.filename) {
      throw new Error("Missing macro information");
    }

    const cycleAnswers = getCycleAnswers(iterationCount);
    const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

    await uploadMeasurement({
      rawMeasurement: scanResult,
      timestamp: analysisTimestampRef.current,
      experimentName,
      experimentId,
      protocolId,
      userId: session?.data?.user?.id,
      macro: {
        id: macro.id,
        name: macro.name,
        filename: macro.filename,
      },
      questions,
    });
    finishFlow();
    setShowRecentMeasurements(true);
  };

  const handleRetry = () => {
    previousStep();
  };

  const handleStartNextMeasurement = () => {
    resetFlow();
    setShowRecentMeasurements(false);
    nextStep();
  };

  if (showRecentMeasurements) {
    return (
      <View className={clsx("flex-1 rounded-xl border", classes.card, classes.border)}>
        <RecentMeasurementsInFlow onStartNextMeasurement={handleStartNextMeasurement} />
      </View>
    );
  }

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
            onPress={() => handleUploadMeasurement().catch(console.log)}
            disabled={isUploading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}
