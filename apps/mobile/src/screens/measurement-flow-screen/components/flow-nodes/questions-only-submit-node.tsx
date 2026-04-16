import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import { FlagTypeModal } from "~/components/recent-measurements-screen/flag-type-modal";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { MeasurementItem } from "~/hooks/use-all-measurements";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { FLAG_TYPE_LABELS } from "~/utils/measurement-annotations";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

import type { AnnotationFlagType } from "@repo/api";

import { AnalysisSummaryCard } from "./analysis-node/analysis-summary-card";

export function QuestionsOnlySubmitNode() {
  const {
    experimentId,
    iterationCount,
    flowNodes,
    dismissQuestionsSubmit,
    finishFlow,
    navigateToQuestionFromOverview,
  } = useMeasurementFlowStore();
  const { classes, colors } = useTheme();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [flagPickerVisible, setFlagPickerVisible] = useState(false);
  const [measurementComment, setMeasurementComment] = useState("");
  const [flagType, setFlagType] = useState<AnnotationFlagType | null>(null);

  const trimmedComment = measurementComment.trim();

  const displayTimestamp = useRef<string>(getSyncedLocalISO()).current;

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
      commentText: trimmedComment || undefined,
      flagType,
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
      <View className="flex-row gap-4 py-2">
        <TouchableOpacity
          onPress={() => setCommentModalVisible(true)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <MessageCircle size={18} color={trimmedComment ? colors.onSurface : colors.inactive} />
          <Text className={clsx("text-sm", trimmedComment ? classes.text : classes.textMuted)}>
            {trimmedComment ? "Edit comment" : "Add comment"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFlagPickerVisible(true)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <Flag size={18} color={flagType ? colors.semantic.error : colors.inactive} />
          <Text className={clsx("text-sm", flagType ? classes.text : classes.textMuted)}>
            {flagType ? FLAG_TYPE_LABELS[flagType] : "Flag"}
          </Text>
        </TouchableOpacity>
      </View>

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

      <MeasurementQuestionsModal
        visible={questionsModalVisible}
        measurement={currentMeasurement}
        onClose={() => setQuestionsModalVisible(false)}
      />

      <FlagTypeModal
        visible={flagPickerVisible}
        selected={flagType}
        onSelect={(type) => {
          setFlagType(type);
          setFlagPickerVisible(false);
        }}
        onCancel={() => setFlagPickerVisible(false)}
      />

      <CommentModal
        visible={commentModalVisible}
        initialText={measurementComment}
        experimentName={experimentName}
        questions={questions}
        timestamp={displayTimestamp}
        onSave={(text) => {
          setMeasurementComment(text);
          setCommentModalVisible(false);
        }}
        onCancel={() => setCommentModalVisible(false)}
      />
    </View>
  );
}
