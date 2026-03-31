import { clsx } from "clsx";
import { ChevronLeft, CircleCheckBig } from "lucide-react-native";
import React, { useRef } from "react";
import { View, Text, ScrollView, Pressable, TouchableOpacity } from "react-native";
import { Button } from "~/components/Button";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

export function QuestionsOnlySubmitNode() {
  const { classes, colors } = useTheme();
  const {
    experimentId,
    iterationCount,
    flowNodes,
    dismissQuestionsSubmit,
    finishFlow,
    previousStep,
    setCurrentFlowStep,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

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

  const handleEditQuestion = (questionLabel: string) => {
    const stepIdx = flowNodes.findIndex((n) => n.name === questionLabel);
    if (stepIdx >= 0) {
      setCurrentFlowStep(stepIdx);
    }
  };

  return (
    <View className="flex-1 px-4 pt-4">
      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={previousStep}
          className="flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.onSurface} />
          <Text className={clsx("text-base", classes.text)}>Back</Text>
        </TouchableOpacity>
        <View className="flex-1" />
        <Text className={clsx("text-lg font-bold", classes.text)}>Review answers</Text>
        <CircleCheckBig size={16} />
      </View>

      <ScrollView className="mt-3 flex-1" showsVerticalScrollIndicator={false}>
        {questions.map((q, idx) => (
          <Pressable
            key={idx}
            className={clsx("border-b py-3", classes.border)}
            onPress={() => handleEditQuestion(q.question_label)}
          >
            <Text className={clsx("mb-1 text-sm font-medium", classes.textMuted)}>
              {q.question_label}
            </Text>
            <Text className={clsx("text-base", classes.text)}>
              {q.question_answer || "—"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

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
    </View>
  );
}
