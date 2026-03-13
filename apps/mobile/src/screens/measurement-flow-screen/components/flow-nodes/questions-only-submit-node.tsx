import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import { DateTime } from "luxon";
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

export function QuestionsOnlySubmitNode() {
  const { classes } = useTheme();
  const { experimentId, iterationCount, flowNodes, dismissQuestionsSubmit, finishFlow } =
    useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const timestampRef = useRef<string>(DateTime.now().toISO() ?? "");

  const experimentName =
    experiments.find((e) => e.value === experimentId)?.label ?? "Experiment";
  const localDate = DateTime.fromISO(timestampRef.current).toFormat("d MMMM yyyy, HH:mm");

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  const handleUpload = async () => {
    if (!experimentId || !session?.data?.user?.id) return;

    await uploadQuestions({
      timestamp: timestampRef.current,
      experimentName,
      experimentId,
      userId: session.data.user.id,
      questions,
    });
  };

  const handleSubmitAndContinue = async () => {
    await handleUpload();
    dismissQuestionsSubmit();
  };

  const handleFinish = async () => {
    await handleUpload();
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
            {questions.length === 0
              ? "None"
              : questions.map((q) => q.question_answer).join(" | ")}
          </Text>
        </Text>
        <Text className={clsx(classes.text)}>
          <Text className="font-semibold">Date: </Text>
          <Text className={clsx(classes.textMuted)}>{localDate}</Text>
        </Text>
      </View>

      <View className="flex-row gap-4 py-3">
        <Button
          title="Finish"
          onPress={() => handleFinish().catch(console.log)}
          disabled={isUploading}
          variant="tertiary"
          style={{ flex: 1, height: 44, borderColor: "transparent" }}
        />
        <Button
          title={isUploading ? "Uploading..." : "Submit & Continue"}
          onPress={() => handleSubmitAndContinue().catch(console.log)}
          disabled={isUploading}
          style={{ flex: 1, height: 44 }}
        />
      </View>
    </View>
  );
}
