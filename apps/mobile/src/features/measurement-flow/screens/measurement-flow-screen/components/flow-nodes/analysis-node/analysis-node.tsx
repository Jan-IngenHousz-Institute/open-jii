import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useScannerCommandExecutorStore } from "~/features/connection/stores/use-scanner-command-executor-store";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { resolveExperimentName } from "~/features/measurement-flow/domain/experiment-name";
import { flowProtocolId } from "~/features/measurement-flow/domain/flow-transitions";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { MacroOutput } from "~/features/measurement-flow/utils/process-scan/process-scan";
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

import { buildCellNamespace } from "@repo/api/transforms/build-cell-namespace";
import { toDeviceContext } from "@repo/api/transforms/device-context";

import { hydrateCells } from "../utils/hydrate-cells";
import { AnalysisActionBar, useScrollToTop } from "./analysis-action-bar";
import { AnalysisMacroResult } from "./analysis-macro-result";
import { AnalysisSummaryCard } from "./analysis-summary-card";

const log = createLogger("analysis-node");

interface AnalysisNodeProps {
  content: AnalysisContent;
  /** Flow node id == workbook cell id of this macro cell. */
  nodeId: string;
}

export function AnalysisNode({ content, nodeId }: AnalysisNodeProps) {
  const { classes } = useTheme();
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
    cells,
    producerCellId,
    cellOutputs,
    workbookVersionId,
    setCellOutput,
  } = useMeasurementFlowStore();
  const protocolId = flowProtocolId(flowNodes);
  const { experiments } = useExperiments();
  const { session } = useSession();
  const executors = useScannerCommandExecutorStore((s) => s.executors);

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

  const { getCycleAnswers, getAnswer } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const { isUploading, uploadMeasurements } = useMeasurementUpload();
  const { updateMeasurementComment } = useMeasurements();

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Upstream outputs this macro reads as `ctx.<name>`: question answers, the
  // live scan and prior macro outputs. beforeIndex stops at this cell, so the
  // macro never reads its own (or a later cell's) output.
  const hydratedCells = useMemo(() => {
    const hydrated = hydrateCells(cells, {
      iterationCount,
      getAnswer,
      scanResult,
      scanResults,
      producerCellId,
      cellOutputs,
    });
    return hydrated;
  }, [cells, iterationCount, getAnswer, scanResult, scanResults, producerCellId, cellOutputs]);

  // One device-scoped ctx per rendered result, including that device's
  // upstream measurement and `$device` identity.
  const macroCtxs = useMemo<Record<string, unknown>[]>(() => {
    const entries = Array.from(executors.values());
    return results.map(({ device }, index) => {
      const entry = device ? executors.get(device.id) : entries[index];
      const identity =
        entry?.identity ??
        (device
          ? { family: "multispeq", name: device.name, deviceId: device.id }
          : entry
            ? { family: "multispeq", name: entry.device.name, deviceId: entry.device.id }
            : undefined);
      const selfIndex = hydratedCells.findIndex((c) => c.id === nodeId);
      return buildCellNamespace(hydratedCells, selfIndex >= 0 ? selfIndex : undefined, {
        deviceId: device?.id,
        device: identity ? toDeviceContext(identity, index) : undefined,
      }).ctx;
    });
  }, [executors, results, hydratedCells, nodeId]);

  // Persist the Primary device's macro output so downstream branches/macros can
  // read it. Compare-before-set: the store write rebuilds ctx and re-runs this
  // callback, so an identical output must not write (and loop) again.
  const handleProcessed = useCallback(
    (outputs: MacroOutput[]) => {
      const first = outputs[0];
      if (first === undefined) return;
      const existing = useMeasurementFlowStore.getState().cellOutputs[nodeId];
      if (existing !== undefined && JSON.stringify(existing) === JSON.stringify(first)) return;
      setCellOutput(nodeId, first);
    },
    [nodeId, setCellOutput],
  );

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
      // Dispatch rounds stamped a per-device protocolId/protocolName on each
      // result; the upload publishes those on their own protocol topic.
      results: results.map(
        ({ device, result, protocolId: resultProtocolId, protocolName }, index) => ({
          rawMeasurement: result,
          device,
          protocolId: resultProtocolId,
          protocolName,
          macroContext: macroCtxs[index],
        }),
      ),
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
      workbookVersionId,
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
                {t("measurementFlow:analysis.workbookRun.deviceHeading", {
                  index: index + 1,
                  name: device?.name ?? `#${index + 1}`,
                })}
              </Text>
              <AnalysisMacroResult
                macro={macro}
                isLoading={false}
                macroId={content.macroId}
                scanResult={result}
                ctx={macroCtxs[index]}
                onProcessed={index === 0 ? handleProcessed : undefined}
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
            ctx={macroCtxs[0]}
            onProcessed={handleProcessed}
            onCommentPress={() => setCommentModalVisible(true)}
          />
        )}
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
