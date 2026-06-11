import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Switch } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { resolveExperimentName } from "~/features/measurement-flow/domain/experiment-name";
import { flowProtocolId } from "~/features/measurement-flow/domain/flow-transitions";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { useMeasurementUpload } from "~/features/recent-measurements/hooks/use-measurement-upload";
import { useMeasurements } from "~/features/recent-measurements/hooks/use-measurements";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { convertCycleAnswersToArray } from "~/shared/measurements/convert-cycle-answers-to-array";
import type { AnalysisContent } from "~/shared/measurements/flow-node";
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
  content: AnalysisContent;
}

export function AnalysisNode({ content }: AnalysisNodeProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  // Resolved once at flow-load (hydrateFlowNodes): cell metadata + derived filename.
  const macro = content.macro;
  const {
    scanResult,
    scanResults,
    previousStep,
    nextStep,
    experimentId,
    experimentLabel,
    iterationCount,
    flowNodes,
  } = useMeasurementFlowStore();
  const protocolId = flowProtocolId(flowNodes);
  const { experiments } = useExperiments();
  const { session } = useSession();

  // Name of the active measurement's protocol, read off its hydrated flow node.
  const activeProtocolName = flowNodes.find(
    (n) => n.type === "measurement" && n.content?.protocolId === protocolId,
  )?.content?.protocol?.name as string | undefined;

  const experimentName = resolveExperimentName({
    experimentLabel,
    experiments,
    experimentId,
    fallback: t("measurementFlow:analysis.node.defaultExperimentName"),
  });

  // Multi-scan results; falls back to the legacy single scanResult for
  // pre-migration persisted flow snapshots.
  const results = useMemo(
    () => scanResults ?? (scanResult ? [{ device: undefined, result: scanResult }] : []),
    [scanResults, scanResult],
  );
  const isMultiDevice = results.length > 1;
  const [bundleEnabled, setBundleEnabled] = useState(true);

  const { getCycleAnswers } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const { isUploading, uploadMeasurements } = useMeasurementUpload();
  const { updateMeasurementComment } = useMeasurements();

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Capture the display timestamp once so it stays stable across re-renders.
  // The upload handler captures its own fresh timestamp independently.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scanResult is an intentional trigger to re-capture the timestamp on new scans
  const displayTimestamp = useMemo(() => getSyncedLocalISO(), [scanResult]);

  // Synthetic StoredMeasurement for the live scan preview, not saved yet.
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
          protocolName: activeProtocolName ?? "",
          timestamp: displayTimestamp,
        },
      },
    }),
    [displayTimestamp, experimentName, questions, activeProtocolName, scanResult],
  );

  const handleUploadMeasurement = async () => {
    if (results.length === 0) {
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

    await uploadMeasurements({
      results: results.map(({ device, result }) => ({ rawMeasurement: result, device })),
      bundle: bundleEnabled && isMultiDevice,
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
      protocolName: activeProtocolName ?? protocolId,
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
          protocolName={
            activeProtocolName ?? t("measurementFlow:analysis.node.defaultProtocolName")
          }
          questions={questions}
          displayTimestamp={displayTimestamp}
          onPress={() => setQuestionsModalVisible(true)}
        />

        {isMultiDevice ? (
          results.map(({ device, result }, index) => (
            <View key={device?.id ?? index}>
              <Text className={clsx("mt-3 text-sm font-bold", classes.text)}>
                {t("measurementFlow:analysis.bundle.deviceHeading", {
                  index: index + 1,
                  name: device?.name ?? `#${index + 1}`,
                })}
              </Text>
              <AnalysisMacroResult
                macro={macro}
                isLoading={false}
                macroId={content.macroId}
                scanResult={result}
                onCommentPress={() => setCommentModalVisible(true)}
              />
            </View>
          ))
        ) : (
          <AnalysisMacroResult
            macro={macro}
            isLoading={false}
            macroId={content.macroId}
            scanResult={scanResult}
            onCommentPress={() => setCommentModalVisible(true)}
          />
        )}
      </ScrollView>

      {isMultiDevice ? (
        <View className="border-divider bg-card mb-2 flex-row items-center gap-3 rounded-xl border px-3.5 py-2.5">
          <View className="min-w-0 flex-1">
            <Text className={clsx("text-sm font-semibold", classes.text)}>
              {t("measurementFlow:analysis.bundle.toggleLabel")}
            </Text>
            <Text className={clsx("text-xs", classes.textMuted)}>
              {t("measurementFlow:analysis.bundle.toggleHint", { count: results.length })}
            </Text>
          </View>
          <Switch
            value={bundleEnabled}
            onValueChange={setBundleEnabled}
            trackColor={{ true: colors.brand }}
          />
        </View>
      ) : null}

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
