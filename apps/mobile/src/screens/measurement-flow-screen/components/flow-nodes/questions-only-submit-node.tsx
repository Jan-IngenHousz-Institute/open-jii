import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useRef } from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { getSyncedLocalISO, getTimeSyncState } from "~/utils/time-sync";

export function QuestionsOnlySubmitNode() {
  const { classes } = useTheme();
  const { experimentId, iterationCount, flowNodes, dismissQuestionsSubmit, finishFlow } =
    useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const timestampRef = useRef<string>(getSyncedLocalISO());

  const experimentName = experiments.find((e) => e.value === experimentId)?.label ?? "Experiment";

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  const canUpload = Boolean(experimentId && session?.data?.user?.id);

  const handleUpload = async (): Promise<boolean> => {
    if (!experimentId) {
      return false;
    }
    if (!session?.data?.user?.id) {
      return false;
    }

    const timestamp = getSyncedLocalISO();
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

      <View className="my-4 gap-1.5 rounded-xl bg-[#EDF2F6] p-4">
        <Text className={clsx(classes.text)}>
          <Text className="font-semibold">Experiment: </Text>
          <Text className={clsx(classes.textMuted)}>{experimentName}</Text>
        </Text>
        <Text className={clsx(classes.text)}>
          <Text className="font-semibold">Answers: </Text>
          <Text className={clsx(classes.textMuted)}>
            {questions.length === 0 ? "None" : questions.map((q) => q.question_answer).join(" | ")}
          </Text>
        </Text>
        <Text className={clsx(classes.text)}>
          <Text className="font-semibold">Date: </Text>
          <Text className={clsx(classes.textMuted)}>{timestampRef.current}</Text>
        </Text>
      </View>

      <View className="flex-row gap-4 py-3">
        <Button
          title="Finish"
          onPress={() => handleFinish().catch(console.log)}
          disabled={isUploading || !canUpload}
          variant="tertiary"
          style={{ flex: 1, height: 44, borderColor: "transparent" }}
        />
        <Button
          title={isUploading ? "Uploading..." : "Submit & Continue"}
          onPress={() => handleSubmitAndContinue().catch(console.log)}
          disabled={isUploading || !canUpload}
          style={{ flex: 1, height: 44 }}
        />
      </View>
    </View>
  );
}
