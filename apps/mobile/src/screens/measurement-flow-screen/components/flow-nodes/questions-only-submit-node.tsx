import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

import { ReadyState } from "./measurement-node/components/ready-state";

export function QuestionsOnlySubmitNode() {
  const {
    experimentId,
    iterationCount,
    flowNodes,
    dismissQuestionsSubmit,
    finishFlow,
    navigateToQuestionFromOverview,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const experimentName = experiments.find((e) => e.value === experimentId)?.label ?? "Experiment";

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  const canUpload = Boolean(experimentId && session?.data?.user?.id);

  const handleCardPress = (flowStepIndex: number) => {
    navigateToQuestionFromOverview(flowStepIndex);
  };

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
    <View className="flex-1">
      <ReadyState onCardPress={handleCardPress} />
      <View className="flex-row gap-4 px-4 py-3">
        <Button
          title="Finish"
          onPress={() => handleFinish().catch(console.error)}
          disabled={isUploading || !canUpload}
          variant="tertiary"
          style={{ flex: 1, height: 44, borderColor: "transparent" }}
        />
        <Button
          title={isUploading ? "Uploading..." : "Submit & Continue"}
          onPress={() => handleSubmitAndContinue().catch(console.error)}
          disabled={isUploading || !canUpload}
          style={{ flex: 1, height: 44 }}
        />
      </View>
    </View>
  );
}
