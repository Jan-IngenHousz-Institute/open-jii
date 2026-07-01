import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useSession } from "~/features/auth/hooks/use-session";
import { useScanner } from "~/features/connection/hooks/use-scan-manager";
import { useExperiments } from "~/features/experiments/hooks/use-experiments";
import { useMacro } from "~/features/measurement-flow/hooks/use-macro";
import { useProtocol } from "~/features/measurement-flow/hooks/use-protocol";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { MacroOutput } from "~/features/measurement-flow/utils/process-scan/process-scan";
import { CommentModal } from "~/features/recent-measurements/components/comment-modal";
import { MeasurementQuestionsModal } from "~/features/recent-measurements/components/measurement-questions-modal";
import { useMeasurementUpload } from "~/features/recent-measurements/hooks/use-measurement-upload";
import type { StoredMeasurement } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { convertCycleAnswersToArray } from "~/shared/measurements/convert-cycle-answers-to-array";
import { createLogger } from "~/shared/observability/logger";
import { getSyncedLocalISO, getSyncedUtcISO, getTimeSyncState } from "~/shared/time/time-sync";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { parseMacroArtifact } from "@repo/api/schemas/macro-artifact.schema";
import { buildCellNamespace } from "@repo/api/utils/build-cell-namespace";
import { validateCommandArtifact } from "@repo/iot";

import { FlowNode } from "../../../types";
import { hydrateCells } from "../utils/hydrate-cells";
import { AnalysisActionBar, useScrollToTop } from "./analysis-action-bar";
import { AnalysisMacroResult } from "./analysis-macro-result";
import { AnalysisSummaryCard } from "./analysis-summary-card";

const log = createLogger("analysis-node");

interface AnalysisNodeProps {
  node: FlowNode;
}

export function AnalysisNode({ node }: AnalysisNodeProps) {
  const content = node.content as { params: Record<string, any>; macroId: string };
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
    cells,
    cellOutputs,
    setCellOutput,
    setScanResult,
  } = useMeasurementFlowStore();
  const { experiments } = useExperiments();
  const { session } = useSession();
  const { executeCommand } = useScanner();

  const experimentName =
    experiments.find((experiment) => experiment.value === experimentId)?.label ??
    t("measurementFlow:analysis.node.defaultExperimentName");

  const { getCycleAnswers, getAnswer } = useFlowAnswersStore();
  const [measurementComment, setMeasurementComment] = useState("");
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [questionsModalVisible, setQuestionsModalVisible] = useState(false);

  const { isUploading, uploadMeasurement } = useMeasurementUpload();
  const { protocol } = useProtocol(protocolId);

  const cycleAnswers = getCycleAnswers(iterationCount);
  const questions = convertCycleAnswersToArray(cycleAnswers, flowNodes);

  // Upstream outputs this macro can read as `ctx.<name>`. Built from the live
  // hydrated cells (question answers + protocol scan + prior macro outputs); the
  // macro's own output is excluded so it never reads itself.
  const macroCtx = useMemo(() => {
    const hydrated = hydrateCells(cells, {
      iterationCount,
      getAnswer,
      scanResult,
      protocolId,
      cellOutputs,
    });
    const ns = buildCellNamespace(hydrated);
    const selfName = Object.keys(ns.names).find((name) => ns.names[name] === node.id);
    const ctx = { ...ns.ctx };
    if (selfName) delete ctx[selfName];
    return ctx;
  }, [cells, iterationCount, getAnswer, scanResult, protocolId, cellOutputs, node.id]);

  // Guards against re-dispatching the same constructed command across re-renders.
  const dispatchedRef = useRef<string | null>(null);

  // Persist the macro output so downstream branches/macros can read it. If the
  // macro returned a constructed command/protocol, validate it on-device and
  // dispatch it, then store the device result under this cell.
  const handleProcessed = useCallback(
    (outputs: MacroOutput[]) => {
      const first = outputs[0];
      if (!first) return;

      const artifact = parseMacroArtifact(first);
      if (!artifact) {
        setCellOutput(node.id, first);
        return;
      }

      const validated = validateCommandArtifact(artifact, { family: "multispeq" });
      if (!validated.ok) {
        setCellOutput(node.id, { error: `Constructed command rejected: ${validated.reason}` });
        return;
      }

      const key = `${node.id}:${iterationCount}`;
      if (dispatchedRef.current === key) return;
      dispatchedRef.current = key;

      void executeCommand(validated.command)
        .then((deviceData: unknown) => {
          setScanResult(deviceData);
          const data =
            deviceData != null && typeof deviceData === "object"
              ? (deviceData as Record<string, unknown>)
              : { response: deviceData };
          setCellOutput(node.id, data);
        })
        .catch((err: unknown) => {
          dispatchedRef.current = null;
          setCellOutput(node.id, {
            error: err instanceof Error ? err.message : "Command dispatch failed",
          });
        });
    },
    [setCellOutput, setScanResult, executeCommand, node.id, iterationCount],
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
          ctx={macroCtx}
          onProcessed={handleProcessed}
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
