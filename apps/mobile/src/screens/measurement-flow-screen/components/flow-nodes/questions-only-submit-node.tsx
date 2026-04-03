import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { MeasurementItem } from "~/hooks/use-all-measurements";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

import { AnalysisSummaryCard } from "./analysis-node/analysis-summary-card";

export function QuestionsOnlySubmitNode() {
  const { classes } = useTheme();
  const { experimentId, iterationCount, flowNodes, dismissQuestionsSubmit, finishFlow } =
    useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const displayTimestamp = useRef<string>(getSyncedLocalISO()).current;

  const experimentName = experiments.find((e) => e.value === experimentId)?.label ?? "Experiment";

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  const currentMeasurement = useMemo<MeasurementItem>(
    () => ({
      key: "current",
      timestamp: displayTimestamp,
      experimentName,
      status: "synced",
      data: {
        topic: "",
        measurementResult: { questions },
        metadata: {
          experimentName,
          protocolName: "",
          timestamp: displayTimestamp,
        },
      },
    }),
    [displayTimestamp, experimentName, questions],
  );

  const canUpload = Boolean(experimentId && session?.data?.user?.id);

  const handleUpload = async (): Promise<boolean> => {
    if (!experimentId) {
      return false;
    }
    if (!session?.data?.user?.id) {
      return false;
    }

    const timestamp = getSyncedUtcISO();
    const timezone = getTimeSyncState().timezone;

    await uploadQuestions({
      timestamp,
      timezone,
      experimentName,
      experimentId,
      userId: session.data.user.id,
      questions,
    });

    return true;
  };

  const handleSubmitAndContinue = async () => {
    const success = await handleUpload();
    if (!success) {
      return;
    }
    dismissQuestionsSubmit();
  };

  const handleFinish = async () => {
    const success = await handleUpload();
    if (!success) {
      return;
    }
    finishFlow();
  };

  return (
    <View className="flex-1 px-4 pt-4">
      <View className="flex-row items-center gap-2">
        <Text className={clsx("text-lg font-bold", classes.text)}>Answers recorded</Text>
        <CircleCheckBig size={16} />
      </View>

      <AnalysisSummaryCard
        experimentName={experimentName}
        questions={questions}
        displayTimestamp={displayTimestamp}
        onPress={() => setQuestionsModalVisible(true)}
      />

      <View className="flex-row gap-4 py-3">
        <Button
          title={isUploading ? "Saving..." : "Save & finish"}
          onPress={() => handleFinish().catch(console.log)}
          disabled={isUploading || !canUpload}
          variant="tertiary"
          style={{ flex: 1, height: 44, borderColor: "transparent" }}
        />
        <Button
          title={isUploading ? "Saving..." : "Save & next"}
          onPress={() => handleSubmitAndContinue().catch(console.log)}
          disabled={isUploading || !canUpload}
          style={{ flex: 1, height: 44 }}
        />
      </View>

      <MeasurementQuestionsModal
        visible={questionsModalVisible}
        measurement={currentMeasurement}
        onClose={() => setQuestionsModalVisible(false)}
      />
    </View>
  );
}
