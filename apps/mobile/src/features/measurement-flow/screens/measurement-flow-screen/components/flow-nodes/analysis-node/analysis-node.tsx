import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { CommentModal } from "~/features/recent-measurements/components/comment-modal";
import { MeasurementQuestionsModal } from "~/features/recent-measurements/components/measurement-questions-modal";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { useMacro } from "~/features/measurement-flow/hooks/use-macro";
import { useMeasurementUpload } from "~/features/recent-measurements/hooks/use-measurement-upload";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useSession } from "~/features/auth/hooks/use-session";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { convertCycleAnswersToArray } from "~/shared/utils/convert-cycle-answers-to-array";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/shared/utils/time-sync";

import { AnalysisActionBar, useScrollToTop } from "./analysis-action-bar";
import { AnalysisMacroResult } from "./analysis-macro-result";
import { AnalysisSummaryCard } from "./analysis-summary-card";

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
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();

  const experimentName =
    experiments.find((experiment) => experiment.value === experimentId)?.label ?? "Experiment";

  const { getCycleAnswers } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const { isUploading, uploadMeasurement } = useMeasurementUpload();
  const { protocol } = useProtocol(protocolId);

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Capture the display timestamp once so it stays stable across re-renders.
  // The upload handler captures its own fresh timestamp independently.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scanResult is an intentional trigger to re-capture the timestamp on new scans
  const displayTimestamp = useMemo(() => getSyncedLocalISO(), [scanResult]);

  const currentMeasurement = useMemo<MeasurementItem>(
    () => ({
      key: "current", // Random key, measurement not saved or uploaded yet
      timestamp: displayTimestamp,
      experimentName,
      status: "successful", // To hide the comment button in modal
      questions,
      data: {
        topic: "",
        measurementResult: { ...(scanResult ?? {}), questions },
        metadata: {
          experimentName,
          protocolName: protocol?.name ?? "",
          timestamp: displayTimestamp,
        },
      },
    }),
    [displayTimestamp, experimentName, questions, protocol?.name, scanResult],
  );

  const handleUploadMeasurement = async () => {
    if (!scanResult) {
      return;
    }

    if (!experimentId) {
      throw new Error("Missing experiment id");
    }

    if (!protocolId) {
      throw new Error("Missing protocol id");
    }

    if (!session?.data?.user?.id) {
      throw new Error("Missing user id");
    }

    if (!macro?.id || !macro?.name || !macro?.filename) {
      throw new Error("Missing macro information");
    }

    // Capture timestamp/timezone at upload time so the sync service
    // has had a chance to complete its first sync.
    const timestamp = getSyncedUtcISO();
    const timezone = getTimeSyncState().timezone;

    await uploadMeasurement({
      rawMeasurement: scanResult,
      timestamp,
      timezone,
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
      commentText: measurementComment.trim() || undefined,
      protocolName: protocol?.name ?? protocolId,
    });
    finishFlow();
  };

  const handleRetry = () => {
    previousStep();
  };

  const { scrollViewRef, hasScrolled, handleScroll, scrollToTop } = useScrollToTop();

  return (
    <View className="flex-1 px-4 pt-4">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        onScroll={handleScroll}
        showsVerticalScrollIndicator={true}
      >
        <View className="flex-row items-center gap-2">
          <Text className={clsx("text-lg font-bold", classes.text)}>Measurement complete</Text>
          <CircleCheckBig size={16} />
        </View>

        <AnalysisSummaryCard
          experimentName={experimentName}
          protocolName={protocol?.name ?? "Protocol"}
          questions={questions}
          displayTimestamp={displayTimestamp}
          onPress={() => setQuestionsModalVisible(true)}
        />

        <AnalysisMacroResult
          macro={macro}
          isLoading={isLoading}
          macroId={content.macroId}
          scanResult={scanResult}
          onCommentPress={() => setCommentModalVisible(true)}
        />
      </ScrollView>

      <AnalysisActionBar
        hasScrolled={hasScrolled}
        isUploading={isUploading}
        onScrollToTop={scrollToTop}
        onRetry={handleRetry}
        onUpload={() => handleUploadMeasurement().catch(console.log)}
      />

      <MeasurementQuestionsModal
        visible={questionsModalVisible}
        measurement={currentMeasurement}
        onClose={() => setQuestionsModalVisible(false)}
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
