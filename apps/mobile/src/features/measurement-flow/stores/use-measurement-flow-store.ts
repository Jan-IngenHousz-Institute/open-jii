import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  DevicePlanEntry,
  FlowState,
  MatchedPath,
  ScanResult,
  ScanResultEntry,
} from "~/features/measurement-flow/domain/flow-transitions";
import {
  dismissQuestionsSubmitState,
  finishFlowState,
  initialFlowState,
  navigateToQuestionFromOverviewState,
  nextStepState,
  previousStepState,
  recordBranchJumpState,
  resetFlowState,
  retryIterationState,
  returnToOverviewState,
  startNewIterationState,
  willNextStepRotateAttempt,
} from "~/features/measurement-flow/domain/flow-transitions";
import { hasUnsupportedMobileWorkbookContent } from "~/features/measurement-flow/utils/workbook-capabilities";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import {
  addExpectedDevice,
  addRealizedOutcome,
  addRealizedLaneStatus,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  setExpectedLaneAssignment,
} from "../domain/workbook-run-manifest";
import type {
  WorkbookRunDeviceOutcome,
  WorkbookRunLaneAssignment,
  WorkbookRunRealizedLane,
  WorkbookRunRealizedProducer,
} from "../domain/workbook-run-manifest";
import { workbookRunnerEnabled } from "../services/workbook-runner-enabled";
import { useRunnerMeasurementFlowStore } from "./use-runner-measurement-flow-store";

export interface MeasurementFlowStore extends FlowState {
  // AutoProceededSummary anchor: first manual question at the start of the
  // current iteration (set by useIterationStateSync). Deliberately NOT
  // persisted; on relaunch it is recomputed by the resume-path sync.
  iterationAnchor?: { iteration: number; nodeId?: string };

  setExperimentId: (experimentId: string, experimentLabel?: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentFlowStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  setFlowNodes: (nodes: FlowNode[]) => void;
  setFlowGraph: (
    nodes: FlowNode[],
    edges: FlowEdge[],
    cells: WorkbookCell[],
    workbookVersionId?: string,
  ) => void;
  setLastMatchedPath: (path: MatchedPath | undefined) => void;
  incrementBranchVisit: (nodeId: string) => void;
  recordBranchJump: (landing: number) => void;
  resetFlow: () => void;
  startNewIteration: () => void;
  retryCurrentIteration: () => void;
  finishFlow: () => void;
  // producerCellId records which cell (protocol or command) yielded the result;
  // omitting it clears any stale attribution.
  setScanResult: (result: ScanResult | undefined, producerCellId?: string) => void;
  // Multi-scan: per-device results in connect order; scanResult mirrors the
  // Primary device's result for branch evaluation and legacy consumers.
  setScanResults: (results: ScanResultEntry[], producerCellId?: string) => void;
  // Persists a macro/analysis output under its cell id for downstream reads.
  setCellOutput: (cellId: string, data: unknown) => void;
  // Dispatcher branch routing: the per-device plan plus the target node ids
  // the round covers beyond the routed-to node (skipped once by nextStep).
  // Passing plan=undefined deactivates dispatch entirely.
  setDevicePlan: (plan: DevicePlanEntry[] | undefined, consumedNodeIds: string[]) => void;
  // Round done: drop the plan but keep consumedNodeIds so advancing still
  // skips the other targets once.
  completeDevicePlan: () => void;
  setIterationAnchor: (anchor: { iteration: number; nodeId?: string }) => void;
  dismissQuestionsSubmit: () => void;
  recordExpectedDevices: (entries: { producerCellId: string; deviceId: string }[]) => void;
  recordExpectedLaneAssignment: (assignment: WorkbookRunLaneAssignment) => void;
  recordRealizedOutcomes: (entries: WorkbookRunRealizedProducer[]) => void;
  recordRealizedLaneStatus: (lane: WorkbookRunRealizedLane) => void;
  recordWorkbookDeviceOutcomes: (entries: WorkbookRunDeviceOutcome[]) => void;
  markWorkbookRunTerminalReady: () => void;
  acknowledgeWorkbookRunManifest: (attemptId: string) => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
}

let rejectedUnsupportedPersistedFlow = false;

/** Consumed by the boot guard after both separately persisted stores hydrate. */
export function consumeRejectedUnsupportedPersistedFlow(): boolean {
  const rejected = rejectedUnsupportedPersistedFlow;
  rejectedUnsupportedPersistedFlow = false;
  return rejected;
}

// Persisted store: a mid-flow blur (background/kill/tab switch) is itself the
// "pause"; relaunch rehydrates the active flow, incl. workbook cells/edges and
// branch state so a resumed branching flow keeps routing offline. Progression
// rules live in ../domain/flow-transitions.ts; the actions here just delegate.
export const useLegacyMeasurementFlowStore = create<MeasurementFlowStore>()(
  persist(
    (set, get) => ({
      ...initialFlowState,
      iterationAnchor: undefined,

      setExperimentId: (experimentId, experimentLabel) =>
        set((state) => {
          const previous = buildPendingManifest({
            attemptId: state.workbookAttemptId,
            workbookVersionId: state.workbookVersionId,
            experimentId: state.experimentId,
            experimentName: state.experimentLabel,
            expected: state.workbookRunExpected,
            realized: state.workbookRunRealized,
            terminalStatus: "abandoned",
          });
          return {
            experimentId,
            experimentLabel,
            workbookAttemptId: uuidv4(),
            workbookRunExpected: [],
            workbookRunRealized: [],
            workbookTerminalReadyAttemptId: undefined,
            pendingWorkbookRunManifests: previous
              ? [...state.pendingWorkbookRunManifests, previous]
              : state.pendingWorkbookRunManifests,
          };
        }),

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentFlowStep: (step) => set({ currentFlowStep: step }),

      nextStep: () => set((state) => nextStepState(state, uuidv4())),
      previousStep: () => set(previousStepState),

      // Route through resetFlow so the persisted slice is cleared too.
      reset: () => get().resetFlow(),

      setFlowNodes: (nodes) =>
        set({
          flowNodes: nodes,
          currentFlowStep: 0,
          cells: [],
          edges: [],
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        }),

      setFlowGraph: (nodes, edges, cells, workbookVersionId) =>
        set((state) => {
          const versionChanged =
            state.workbookVersionId !== undefined && state.workbookVersionId !== workbookVersionId;
          const previous = versionChanged
            ? buildPendingManifest({
                attemptId: state.workbookAttemptId,
                workbookVersionId: state.workbookVersionId,
                experimentId: state.experimentId,
                experimentName: state.experimentLabel,
                expected: state.workbookRunExpected,
                realized: state.workbookRunRealized,
                terminalStatus: "abandoned",
              })
            : undefined;
          return {
            flowNodes: nodes,
            edges,
            cells,
            workbookVersionId,
            ...(versionChanged
              ? {
                  workbookAttemptId: uuidv4(),
                  workbookRunExpected: [],
                  workbookRunRealized: [],
                  workbookTerminalReadyAttemptId: undefined,
                  pendingWorkbookRunManifests: previous
                    ? [...state.pendingWorkbookRunManifests, previous]
                    : state.pendingWorkbookRunManifests,
                }
              : {}),
            currentFlowStep: 0,
            branchVisitCounts: {},
            lastMatchedPath: undefined,
            branchReturnStack: [],
          };
        }),

      setLastMatchedPath: (path) => set({ lastMatchedPath: path }),

      incrementBranchVisit: (nodeId) =>
        set((state) => ({
          branchVisitCounts: {
            ...state.branchVisitCounts,
            [nodeId]: (state.branchVisitCounts[nodeId] ?? 0) + 1,
          },
        })),

      recordBranchJump: (landing) => set((state) => recordBranchJumpState(state, landing)),

      resetFlow: () => set((state) => ({ ...resetFlowState(state), iterationAnchor: undefined })),

      startNewIteration: () => set((state) => startNewIterationState(state, uuidv4())),

      retryCurrentIteration: () => set((state) => retryIterationState(state, uuidv4())),

      finishFlow: () => set(finishFlowState),

      setScanResult: (result, producerCellId) =>
        set({
          scanResult: result,
          scanResults: result === undefined ? undefined : [{ result }],
          producerCellId,
        }),

      setScanResults: (results, producerCellId) =>
        set({ scanResults: results, scanResult: results[0]?.result, producerCellId }),

      setCellOutput: (cellId, data) =>
        set((state) => ({ cellOutputs: { ...state.cellOutputs, [cellId]: data } })),

      setDevicePlan: (plan, consumedNodeIds) => set({ devicePlan: plan, consumedNodeIds }),

      completeDevicePlan: () => set({ devicePlan: undefined }),

      setIterationAnchor: (anchor) => set({ iterationAnchor: anchor }),

      dismissQuestionsSubmit: () => set((state) => dismissQuestionsSubmitState(state, uuidv4())),

      recordExpectedDevices: (entries) =>
        set((state) => ({
          workbookRunExpected: entries.reduce(
            (expected, entry) => addExpectedDevice(expected, entry.producerCellId, entry.deviceId),
            state.workbookRunExpected,
          ),
        })),

      // Intentional PR-2b wiring seam: mobile rejects containers in this PR,
      // so no production caller can record lane entry yet.
      recordExpectedLaneAssignment: (assignment) =>
        set((state) => ({
          workbookRunExpected: setExpectedLaneAssignment(state.workbookRunExpected, assignment),
        })),

      recordRealizedOutcomes: (entries) =>
        set((state) => ({
          workbookRunRealized: entries.reduce(
            (realized, entry) => addRealizedOutcome(realized, entry),
            state.workbookRunRealized,
          ),
        })),

      // Intentional PR-2b wiring seam: terminal lane events do not reach the
      // mobile manifest owner until mobile container execution lands.
      recordRealizedLaneStatus: (lane) =>
        set((state) => ({
          workbookRunRealized: addRealizedLaneStatus(state.workbookRunRealized, lane),
        })),

      recordWorkbookDeviceOutcomes: (entries) =>
        set((state) => {
          const next = entries.reduce(
            (ledger, entry) => addWorkbookDeviceOutcome(ledger.expected, ledger.realized, entry),
            {
              expected: state.workbookRunExpected,
              realized: state.workbookRunRealized,
            },
          );
          return {
            workbookRunExpected: next.expected,
            workbookRunRealized: next.realized,
          };
        }),

      markWorkbookRunTerminalReady: () =>
        set((state) => {
          if (
            !willNextStepRotateAttempt(state) ||
            !state.workbookAttemptId ||
            state.workbookTerminalReadyAttemptId === state.workbookAttemptId
          ) {
            return state;
          }
          const manifest = buildPendingManifest({
            attemptId: state.workbookAttemptId,
            workbookVersionId: state.workbookVersionId,
            experimentId: state.experimentId,
            experimentName: state.experimentLabel,
            expected: state.workbookRunExpected,
            realized: state.workbookRunRealized,
          });
          if (!manifest) return state;
          return {
            workbookTerminalReadyAttemptId: state.workbookAttemptId,
            pendingWorkbookRunManifests: state.pendingWorkbookRunManifests.some(
              (pending) =>
                pending.record.workbook_attempt_id === manifest.record.workbook_attempt_id,
            )
              ? state.pendingWorkbookRunManifests
              : [...state.pendingWorkbookRunManifests, manifest],
          };
        }),

      acknowledgeWorkbookRunManifest: (attemptId) =>
        set((state) => ({
          pendingWorkbookRunManifests: state.pendingWorkbookRunManifests.filter(
            (manifest) => manifest.record.workbook_attempt_id !== attemptId,
          ),
        })),

      navigateToQuestionFromOverview: (questionIndex) =>
        set(navigateToQuestionFromOverviewState(questionIndex)),

      returnToOverview: () => set(returnToOverviewState),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v2 adds attempt/manifest state to the already-shipped v1 wire format.
      // Active v1 flows mint an attempt during hydration so resume can upload.
      version: 2,
      migrate: (persisted, version) => {
        if (version < 1) return initialFlowState;
        if (version < 2) {
          const legacy: Partial<FlowState> =
            persisted !== null && typeof persisted === "object" ? { ...persisted } : {};
          return {
            ...legacy,
            workbookAttemptId:
              legacy.workbookAttemptId ?? (legacy.experimentId ? uuidv4() : undefined),
            workbookRunExpected: legacy.workbookRunExpected ?? [],
            workbookRunRealized: legacy.workbookRunRealized ?? [],
            workbookTerminalReadyAttemptId: undefined,
            pendingWorkbookRunManifests: legacy.pendingWorkbookRunManifests ?? [],
          };
        }
        return persisted;
      },
      // Reject unsupported content in persist's merge itself. It therefore
      // never enters the live Zustand state or renders before AppBootstrap's
      // later consistency cleanup can clear the stored envelope and answers.
      merge: (persisted, current) => {
        const persistedState =
          persisted !== null && typeof persisted === "object"
            ? (persisted as Partial<FlowState>)
            : {};
        if (hasUnsupportedMobileWorkbookContent(persistedState)) {
          rejectedUnsupportedPersistedFlow = true;
          return current;
        }
        return { ...current, ...persistedState };
      },
      // protocolId was dropped from the persisted slice (now derived from
      // flowNodes via flowProtocolId); legacy payloads carrying it merge in
      // as an ignored extra key.
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        workbookVersionId: state.workbookVersionId,
        workbookAttemptId: state.workbookAttemptId,
        workbookRunExpected: state.workbookRunExpected,
        workbookRunRealized: state.workbookRunRealized,
        workbookTerminalReadyAttemptId: state.workbookTerminalReadyAttemptId,
        pendingWorkbookRunManifests: state.pendingWorkbookRunManifests,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
        scanResults: state.scanResults,
        producerCellId: state.producerCellId,
        cellOutputs: state.cellOutputs,
        isFromOverview: state.isFromOverview,
        cells: state.cells,
        edges: state.edges,
        branchVisitCounts: state.branchVisitCounts,
        lastMatchedPath: state.lastMatchedPath,
        branchReturnStack: state.branchReturnStack,
      }),
    },
  ),
);

/**
 * Short-lived migration seam: production remains on the behavioral oracle by
 * default, while qualification builds can opt into the fresh runner store.
 */
export const useMeasurementFlowStore = workbookRunnerEnabled
  ? (useRunnerMeasurementFlowStore as typeof useLegacyMeasurementFlowStore)
  : useLegacyMeasurementFlowStore;
