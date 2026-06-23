import clsx from "clsx";
import { Flag, MessageCircleMore } from "lucide-react-native";
import React, { useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { useFinishFlow } from "~/features/measurement-flow/hooks/use-finish-flow";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useQuestionsUpload } from "~/features/recent-measurements/hooks/use-questions-upload";
import { useTranslation } from "~/shared/i18n";
import { convertCycleAnswersToArray } from "~/shared/measurements/convert-cycle-answers-to-array";
import { FLAG_TYPE_LABELS } from "~/shared/measurements/measurement-annotations";
import { createLogger } from "~/shared/observability/logger";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/shared/time/time-sync";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { CommentModal } from "~/shared/ui/measurement/comment-modal";
import { FlagTypeModal } from "~/shared/ui/measurement/flag-type-modal";

import type { ExperimentAnnotationFlagType } from "@repo/api/domains/experiment/experiment.schema";

import { ReadyState } from "./measurement-node/components/ready-state";

const log = createLogger("questions-submit");

export function QuestionsOnlySubmitNode() {
  const {
    experimentId,
    iterationCount,
    flowNodes,
    dismissQuestionsSubmit,
    navigateToQuestionFromOverview,
  } = useMeasurementFlowStore();
  const finishAndExit = useFinishFlow();
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [flagPickerVisible, setFlagPickerVisible] = useState(false);
  const [measurementComment, setMeasurementComment] = useState("");
  const [flagType, setFlagType] = useState<ExperimentAnnotationFlagType | null>(null);

  const trimmedComment = measurementComment.trim();

  const displayTimestamp = useRef<string>(getSyncedLocalISO()).current;

  const experimentName =
    experiments.find((e) => e.value === experimentId)?.label ??
    t("measurementFlow:questionsSubmit.defaultExperimentName");

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  const canUpload = Boolean(experimentId && session?.data?.user?.id);

  const handleCardPress = (flowStepIndex: number) => {
    navigateToQuestionFromOverview(flowStepIndex);
  };

  const handleUpload = async (): Promise<boolean> => {
    log.info("handleUpload invoked", { hasComment: Boolean(trimmedComment), flagType });
    if (!experimentId) {
      log.warn("handleUpload missing experimentId");
      return false;
    }
    if (!session?.data?.user?.id) {
      log.warn("handleUpload missing user id");
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

    log.info("handleUpload returned");
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
    finishAndExit();
  };

  return (
    <View className="flex-1">
      <ReadyState onCardPress={handleCardPress} />
      <View className="flex-row gap-4 px-4 py-2">
        <TouchableOpacity
          onPress={() => setCommentModalVisible(true)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <MessageCircleMore
            size={18}
            color={trimmedComment ? colors.onSurface : colors.inactive}
          />
          <Text className={clsx("text-sm", trimmedComment ? classes.text : classes.textMuted)}>
            {trimmedComment
              ? t("measurementFlow:questionsSubmit.editComment")
              : t("measurementFlow:questionsSubmit.addComment")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFlagPickerVisible(true)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <Flag size={18} color={flagType ? colors.semantic.error : colors.inactive} />
          <Text className={clsx("text-sm", flagType ? classes.text : classes.textMuted)}>
            {flagType ? FLAG_TYPE_LABELS[flagType] : t("measurementFlow:questionsSubmit.flag")}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row gap-4 px-4 py-3">
        <Button
          title={t("measurementFlow:questionsSubmit.finish")}
          onPress={() =>
            handleFinish().catch((e) => log.error("handler failed", { err: (e as Error)?.message }))
          }
          disabled={isUploading || !canUpload}
          variant="tertiary"
          style={{ flex: 1, height: 44, borderColor: "transparent" }}
        />
        <Button
          title={
            isUploading
              ? t("measurementFlow:questionsSubmit.uploading")
              : t("measurementFlow:questionsSubmit.submitContinue")
          }
          onPress={() =>
            handleSubmitAndContinue().catch((e) =>
              log.error("handler failed", { err: (e as Error)?.message }),
            )
          }
          disabled={isUploading || !canUpload}
          style={{ flex: 1, height: 44 }}
        />
      </View>

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
