import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import type { FlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { MeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { createLogger } from "~/shared/observability/logger";

import { isRuntimeCellOutput } from "@repo/api/transforms/runtime-output";

const log = createLogger("flow-rehydration-guard");

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

/** Validate only the persisted protocol, never transient actions or UI data. */
export function isResumableFlowState(state: MeasurementFlowStore): boolean {
  if (
    !Array.isArray(state.flowNodes) ||
    !Array.isArray(state.cells) ||
    !Array.isArray(state.edges) ||
    !Array.isArray(state.consumedNodeIds) ||
    !isRecord(state.branchVisitCounts) ||
    !isRecord(state.outputsByCellId) ||
    !Number.isInteger(state.currentFlowStep) ||
    state.currentFlowStep < 0 ||
    !Number.isInteger(state.iterationCount) ||
    state.iterationCount < 0
  ) {
    return false;
  }

  const outputs = Object.values(state.outputsByCellId);
  if (outputs.length > 0 && (!state.workbookVersionId || !state.executionEpoch)) return false;
  for (const output of outputs) {
    if (!isRuntimeCellOutput(output)) return false;
    if (
      output.provenance.workbookVersionId !== state.workbookVersionId ||
      output.provenance.executionEpoch !== state.executionEpoch
    ) {
      return false;
    }
    if (
      output.scope === "device" &&
      new Set(output.deviceResults.map((result) => result.deviceId)).size !==
        output.deviceResults.length
    ) {
      return false;
    }
  }

  const hasLoadedIdentity =
    !!state.loadedExperimentId || !!state.workbookVersionId || !!state.executionEpoch;
  if (
    hasLoadedIdentity &&
    (!state.loadedExperimentId || !state.workbookVersionId || !state.executionEpoch)
  ) {
    return false;
  }
  if (state.experimentId && state.experimentId !== state.loadedExperimentId) return false;
  return true;
}

export function isResumableAnswersState(state: FlowAnswersStore): boolean {
  return (
    Array.isArray(state.answersHistory) &&
    state.answersHistory.every(isStringRecord) &&
    isBooleanRecord(state.autoincrementSettings) &&
    isBooleanRecord(state.rememberAnswerSettings)
  );
}

export function areFlowStoresConsistent(
  flow: MeasurementFlowStore,
  answers: FlowAnswersStore,
): boolean {
  if (!isResumableFlowState(flow) || !isResumableAnswersState(answers)) return false;
  return !!flow.experimentId || answers.answersHistory.length === 0;
}

// The two flow stores persist under separate AsyncStorage keys, so a kill
// between their writes can leave malformed or cross-cycle state. Once BOTH
// have hydrated, either both stores resume consistently or both are reset.
// Mounted once at app boot; returns an unsubscribe fn.
export function installFlowRehydrationGuard(): () => void {
  const check = () => {
    if (
      !useMeasurementFlowStore.persist.hasHydrated() ||
      !useFlowAnswersStore.persist.hasHydrated()
    ) {
      return;
    }
    const flow = useMeasurementFlowStore.getState();
    const answers = useFlowAnswersStore.getState();
    if (!areFlowStoresConsistent(flow, answers)) {
      log.warn("persisted flow state rejected", { code: "FLOW_RESUME_STATE_INVALID" });
      flow.resetIncompatibleResume();
    }
  };

  const unsubFlow = useMeasurementFlowStore.persist.onFinishHydration(check);
  const unsubAnswers = useFlowAnswersStore.persist.onFinishHydration(check);
  check();
  return () => {
    unsubFlow();
    unsubAnswers();
  };
}
