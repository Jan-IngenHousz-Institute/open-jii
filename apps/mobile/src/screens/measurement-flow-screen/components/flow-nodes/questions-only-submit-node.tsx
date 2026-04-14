import { clsx } from "clsx";
import { CircleCheckBig, Flag, MessageCircle } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Button } from "~/components/Button";
import { CommentModal } from "~/components/recent-measurements-screen/comment-modal";
import type {AnnotationFlagType} from "@repo/api";
import { FlagTypeModal } from "~/components/recent-measurements-screen/flag-type-modal";
import { MeasurementQuestionsModal } from "~/components/recent-measurements-screen/measurement-questions-modal";
import { MeasurementItem } from "~/hooks/use-all-measurements";
import { useExperiments } from "~/hooks/use-experiments";
import { useQuestionsUpload } from "~/hooks/use-questions-upload";
import { useSession } from "~/hooks/use-session";
import { useTheme } from "~/hooks/use-theme";
import { useFlowAnswersStore } from "~/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/utils/convert-cycle-answers-to-array";
import { FLAG_TYPE_LABELS } from "~/utils/measurement-annotations";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/utils/time-sync";

import type {AnnotationFlagType} from "@repo/api";

import { AnalysisSummaryCard } from "./analysis-node/analysis-summary-card";

export function QuestionsOnlySubmitNode() {
  const { classes, colors } = useTheme();
  const { experimentId, iterationCount, flowNodes, dismissQuestionsSubmit, finishFlow } =
    useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { getCycleAnswers } = useFlowAnswersStore();
  const { isUploading, uploadQuestions } = useQuestionsUpload();

  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [flagPickerVisible, setFlagPickerVisible] = useState(false);
  const [measurementComment, setMeasurementComment] = useState("");
  const [flagType, setFlagType] = useState<AnnotationFlagType | null>(null);

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
      commentText: measurementComment.trim() || undefined,
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

      <View className="flex-row gap-4 py-2">
        <TouchableOpacity
          onPress={() => setCommentModalVisible(true)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <MessageCircle
            size={18}
            color={measurementComment ? colors.onSurface : colors.inactive}
          />
          <Text className={clsx("text-sm", measurementComment ? classes.text : classes.textMuted)}>
            {measurementComment ? "Edit comment" : "Add comment"}
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
