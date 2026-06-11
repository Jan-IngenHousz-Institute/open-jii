import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { useMacro } from "~/features/measurement-flow/hooks/use-macro";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useMeasurementUpload } from "~/features/recent-measurements/hooks/use-measurement-upload";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { convertCycleAnswersToArray } from "~/shared/measurements/convert-cycle-answers-to-array";
import { createLogger } from "~/shared/observability/logger";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/shared/time/time-sync";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { CommentModal } from "~/shared/ui/measurement/comment-modal";
import { MeasurementQuestionsModal } from "~/shared/ui/measurement/measurement-questions-modal";

import { AnalysisActionBar, useScrollToTop } from "./analysis-action-bar";
import { AnalysisMacroResult } from "./analysis-macro-result";
import { AnalysisSummaryCard } from "./analysis-summary-card";

const log = createLogger("analysis-node");

interface AnalysisNodeProps {
  content: {
    params: Record<string, any>;
    macroId: string;
  };
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { macro, isLoading } = useMacro(content.macroId);
  const {
    scanResult,
    previousStep,
    nextStep,
    experimentId,
    protocolId,
    iterationCount,
    flowNodes,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();

  const experimentName =
    experiments.find((experiment) => experiment.value === experimentId)?.label ??
    t("measurementFlow:analysis.node.defaultExperimentName");

  const { getCycleAnswers } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const { isUploading, uploadMeasurement } = useMeasurementUpload();
  const { updateMeasurementComment } = useMeasurements();
  const { protocol } = useProtocol(protocolId);

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Capture the display timestamp once so it stays stable across re-renders.
  // The upload handler captures its own fresh timestamp independently.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scanResult is an intentional trigger to re-capture the timestamp on new scans
  const displayTimestamp = useMemo(() => getSyncedLocalISO(), [scanResult]);

  // Synthetic StoredMeasurement for the live scan preview — not saved yet.
  // status "successful" hides the comment button in the modal.
  const currentMeasurement = useMemo<StoredMeasurement>(
    () => ({
      id: "current",
      status: "successful",
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
    nextStep();
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
          <Text className={clsx("text-lg font-bold", classes.text)}>
            {t("measurementFlow:analysis.node.heading")}
          </Text>
          <CircleCheckBig size={16} />
        </View>

        <AnalysisSummaryCard
          experimentName={experimentName}
          protocolName={protocol?.name ?? t("measurementFlow:analysis.node.defaultProtocolName")}
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
        onUpload={() =>
          handleUploadMeasurement().catch((e) =>
            log.warn("handleUploadMeasurement failed", { err: (e as Error)?.message }),
          )
        }
      />

      <MeasurementQuestionsModal
        visible={questionsModalVisible}
        measurement={currentMeasurement}
        onClose={() => setQuestionsModalVisible(false)}
        onSaveComment={(text) =>
          updateMeasurementComment(currentMeasurement.id, currentMeasurement.data, text)
        }
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
