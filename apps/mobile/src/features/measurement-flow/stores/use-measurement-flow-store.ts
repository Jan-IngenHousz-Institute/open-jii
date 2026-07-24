import AsyncStorage from "@react-native-async-storage/async-storage";
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
  createExecutionEpoch,
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
} from "~/features/measurement-flow/domain/flow-transitions";
import {
  deviceOutputFromScanResults,
  mergeDeviceMacroOutput,
  mergeDeviceProducerOutput,
  producerKindFor,
  sharedMacroOutput,
} from "~/features/measurement-flow/domain/runtime-output";
import type {
  DeviceProducerOutcome,
  MobileProducerKind,
} from "~/features/measurement-flow/domain/runtime-output";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import {
  hasMatchingProvenance,
  isRuntimeCellOutput,
  runtimeOutputFromQuestionAnswer,
} from "@repo/api/transforms/runtime-output";
import type { RuntimeCellOutput } from "@repo/api/transforms/runtime-output";

export interface MeasurementFlowStore extends FlowState {
  // AutoProceededSummary anchor: first manual question at the start of the
  // current iteration (set by useIterationStateSync). Deliberately NOT
  // persisted; on relaunch it is recomputed by the resume-path sync.
  iterationAnchor?: { iteration: number; nodeId?: string };
  /** Transient user-visible reason that a persisted cycle could not resume. */
  resumeResetReason?: "FLOW_RESUME_STATE_INVALID";

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
    loadedExperimentId?: string,
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
  setScanResult: (
    result: ScanResult | undefined,
    producerCellId?: string,
    device?: { id: string; name: string },
  ) => void;
  // Multi-scan: per-device results in connect order; scanResult mirrors the
  // Primary device's result for branch evaluation and legacy consumers.
  setScanResults: (results: ScanResultEntry[], producerCellId?: string) => void;
  // Records a workbook-shared or exact-device macro result without replacing
  // other producers/devices from this cycle.
  setMacroOutput: (cellId: string, data: unknown, device?: { id: string; name?: string }) => void;
  /** Merge exact-device producer completions without changing scan projections. */
  recordDeviceProducerOutcomes: (
    cellId: string,
    kind: MobileProducerKind,
    outcomes: DeviceProducerOutcome[],
  ) => void;
  /** Single resolver adapter, including current-cycle question answers. */
  getRuntimeCellOutput: (cellId: string) => RuntimeCellOutput | undefined;
  /** Coordinated guard reset after malformed/inconsistent persistence. */
  resetIncompatibleResume: () => void;
  // Dispatcher branch routing: the per-device plan plus the target node ids
  // the round covers beyond the routed-to node (skipped once by nextStep).
  // Passing plan=undefined deactivates dispatch entirely.
  setDevicePlan: (plan: DevicePlanEntry[] | undefined, consumedNodeIds: string[]) => void;
  // Round done: drop the plan but keep consumedNodeIds so advancing still
  // skips the other targets once.
  completeDevicePlan: () => void;
  setIterationAnchor: (anchor: { iteration: number; nodeId?: string }) => void;
  dismissQuestionsSubmit: () => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function migrateMeasurementFlowState(
  persisted: unknown,
  version: number,
  epochFactory: () => string = createExecutionEpoch,
): unknown {
  if (version < 1 || !isRecord(persisted)) return initialFlowState;
  if (version >= 2) return persisted;

  const workbookVersionId =
    typeof persisted.workbookVersionId === "string" ? persisted.workbookVersionId : undefined;
  const executionEpoch = workbookVersionId ? epochFactory() : undefined;
  const provenance =
    workbookVersionId && executionEpoch ? { workbookVersionId, executionEpoch } : undefined;
  const cells = Array.isArray(persisted.cells) ? (persisted.cells as WorkbookCell[]) : [];
  const flowNodes = Array.isArray(persisted.flowNodes) ? (persisted.flowNodes as FlowNode[]) : [];
  const outputsByCellId: Record<string, RuntimeCellOutput> = {};

  // V1 `cellOutputs` held macro results. Only known macro/analysis producers
  // migrate as shared; an ambiguous producer remains non-resolvable.
  if (provenance && isRecord(persisted.cellOutputs)) {
    for (const [cellId, data] of Object.entries(persisted.cellOutputs)) {
      if (producerKindFor(cellId, cells, flowNodes) === "macro") {
        outputsByCellId[cellId] = sharedMacroOutput(data, provenance);
      }
    }
  }

  // V1's singular scan may migrate only when it is attributed and every
  // retained result has an exact device id. Otherwise keep the display/upload
  // projection but do not make it resolver-authoritative.
  if (
    provenance &&
    typeof persisted.producerCellId === "string" &&
    Array.isArray(persisted.scanResults)
  ) {
    const kind = producerKindFor(persisted.producerCellId, cells, flowNodes);
    const scanResults = persisted.scanResults.flatMap((entry) => {
      if (
        !isRecord(entry) ||
        !("result" in entry) ||
        !isRecord(entry.device) ||
        typeof entry.device.id !== "string" ||
        entry.device.id.length === 0
      ) {
        return [];
      }
      return [
        {
          result: entry.result,
          device: {
            id: entry.device.id,
            name: typeof entry.device.name === "string" ? entry.device.name : undefined,
          },
        },
      ];
    });
    if (
      (kind === "protocol" || kind === "command") &&
      scanResults.length === persisted.scanResults.length
    ) {
      const output = deviceOutputFromScanResults(scanResults, kind, provenance);
      if (output) outputsByCellId[persisted.producerCellId] = output;
    }
  }

  const { cellOutputs: _legacyCellOutputs, ...state } = persisted;
  return {
    ...state,
    loadedExperimentId:
      typeof persisted.experimentId === "string" ? persisted.experimentId : undefined,
    executionEpoch,
    outputsByCellId,
  };
}

// Persisted store: a mid-flow blur (background/kill/tab switch) is itself the
// "pause"; relaunch rehydrates the active flow, incl. workbook cells/edges and
// branch state so a resumed branching flow keeps routing offline. Progression
// rules live in ../domain/flow-transitions.ts; the actions here just delegate.
export const useMeasurementFlowStore = create<MeasurementFlowStore>()(
  persist(
    (set, get) => ({
      ...initialFlowState,
      iterationAnchor: undefined,
      resumeResetReason: undefined,

      setExperimentId: (experimentId, experimentLabel) => {
        const current = get();
        if (
          (current.experimentId && current.experimentId !== experimentId) ||
          (current.loadedExperimentId && current.loadedExperimentId !== experimentId)
        ) {
          useFlowAnswersStore.getState().clearHistory();
          set({
            ...resetFlowState(),
            experimentId,
            experimentLabel,
            resumeResetReason: undefined,
          });
          return;
        }
        set({ experimentId, experimentLabel, resumeResetReason: undefined });
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentFlowStep: (step) => set({ currentFlowStep: step }),

      nextStep: () => set(nextStepState),
      previousStep: () =>
        set((state) => {
          const next = previousStepState(state);
          if (state.experimentId && next.experimentId === undefined) {
            useFlowAnswersStore.getState().clearHistory();
          }
          return next;
        }),

      // Route through resetFlow so the persisted slice is cleared too.
      reset: () => get().resetFlow(),

      setFlowNodes: (nodes) => {
        useFlowAnswersStore.getState().clearHistory();
        set({
          ...resetFlowState(),
          flowNodes: nodes,
          resumeResetReason: undefined,
        });
      },

      setFlowGraph: (nodes, edges, cells, workbookVersionId, loadedExperimentId) => {
        const current = get();
        const sameVersion =
          !!workbookVersionId &&
          !!loadedExperimentId &&
          current.workbookVersionId === workbookVersionId &&
          current.loadedExperimentId === loadedExperimentId;

        if (sameVersion) {
          set({ flowNodes: nodes, edges, cells });
          return;
        }

        useFlowAnswersStore.getState().clearHistory();
        set({
          flowNodes: nodes,
          edges,
          cells,
          workbookVersionId,
          loadedExperimentId,
          experimentId:
            current.experimentId === loadedExperimentId ? current.experimentId : undefined,
          executionEpoch: workbookVersionId ? createExecutionEpoch() : undefined,
          outputsByCellId: {},
          scanResult: undefined,
          scanResults: undefined,
          producerCellId: undefined,
          currentFlowStep: 0,
          iterationCount: 0,
          isFlowFinished: false,
          isQuestionsSubmitPending: false,
          isFromOverview: false,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
          devicePlan: undefined,
          consumedNodeIds: [],
          iterationAnchor: undefined,
          resumeResetReason: undefined,
        });
      },

      setLastMatchedPath: (path) => set({ lastMatchedPath: path }),

      incrementBranchVisit: (nodeId) =>
        set((state) => ({
          branchVisitCounts: {
            ...state.branchVisitCounts,
            [nodeId]: (state.branchVisitCounts[nodeId] ?? 0) + 1,
          },
        })),

      recordBranchJump: (landing) => set((state) => recordBranchJumpState(state, landing)),

      resetFlow: () => {
        useFlowAnswersStore.getState().clearHistory();
        set({ ...resetFlowState(), iterationAnchor: undefined, resumeResetReason: undefined });
      },

      startNewIteration: () => set(startNewIterationState),

      retryCurrentIteration: () => {
        useFlowAnswersStore.getState().clearCycle(get().iterationCount);
        set(retryIterationState());
      },

      finishFlow: () => set(finishFlowState),

      setScanResult: (result, producerCellId, device) => {
        if (result === undefined) {
          set({ scanResult: undefined, scanResults: undefined, producerCellId });
          return;
        }
        get().setScanResults([{ result, device }], producerCellId);
      },

      setScanResults: (results, producerCellId) =>
        set((state) => {
          let outputsByCellId = state.outputsByCellId;
          if (producerCellId && state.workbookVersionId && state.executionEpoch) {
            const kind = producerKindFor(producerCellId, state.cells, state.flowNodes);
            if (kind === "protocol" || kind === "command") {
              const output = deviceOutputFromScanResults(results, kind, {
                workbookVersionId: state.workbookVersionId,
                executionEpoch: state.executionEpoch,
              });
              if (output) outputsByCellId = { ...outputsByCellId, [producerCellId]: output };
            }
          }
          return {
            scanResults: results,
            scanResult: results[0]?.result,
            producerCellId,
            outputsByCellId,
          };
        }),

      setMacroOutput: (cellId, data, device) =>
        set((state) => {
          if (!state.workbookVersionId || !state.executionEpoch) return state;
          const provenance = {
            workbookVersionId: state.workbookVersionId,
            executionEpoch: state.executionEpoch,
          };
          const output = device
            ? mergeDeviceMacroOutput(state.outputsByCellId[cellId], device, data, provenance)
            : sharedMacroOutput(data, provenance);
          return { outputsByCellId: { ...state.outputsByCellId, [cellId]: output } };
        }),

      recordDeviceProducerOutcomes: (cellId, kind, outcomes) =>
        set((state) => {
          if (!state.workbookVersionId || !state.executionEpoch || outcomes.length === 0) {
            return state;
          }
          const output = mergeDeviceProducerOutput(state.outputsByCellId[cellId], kind, outcomes, {
            workbookVersionId: state.workbookVersionId,
            executionEpoch: state.executionEpoch,
          });
          return { outputsByCellId: { ...state.outputsByCellId, [cellId]: output } };
        }),

      getRuntimeCellOutput: (cellId) => {
        const state = get();
        if (!state.workbookVersionId || !state.executionEpoch) return undefined;
        const cell = state.cells.find((candidate) => candidate.id === cellId);
        if (cell?.type === "question") {
          const answer = useFlowAnswersStore.getState().getAnswer(state.iterationCount, cellId);
          return answer === undefined
            ? undefined
            : runtimeOutputFromQuestionAnswer(answer, {
                workbookVersionId: state.workbookVersionId,
                executionEpoch: state.executionEpoch,
              });
        }
        const output = state.outputsByCellId[cellId];
        return isRuntimeCellOutput(output) &&
          hasMatchingProvenance(output.provenance, {
            workbookVersionId: state.workbookVersionId,
            executionEpoch: state.executionEpoch,
          })
          ? output
          : undefined;
      },

      resetIncompatibleResume: () => {
        useFlowAnswersStore.getState().clearHistory();
        set({
          ...resetFlowState(),
          iterationAnchor: undefined,
          resumeResetReason: "FLOW_RESUME_STATE_INVALID",
        });
      },

      setDevicePlan: (plan, consumedNodeIds) => set({ devicePlan: plan, consumedNodeIds }),

      completeDevicePlan: () => set({ devicePlan: undefined }),

      setIterationAnchor: (anchor) => set({ iterationAnchor: anchor }),

      dismissQuestionsSubmit: () => set(dismissQuestionsSubmitState),

      navigateToQuestionFromOverview: (questionIndex) =>
        set(navigateToQuestionFromOverviewState(questionIndex)),

      returnToOverview: () => set(returnToOverviewState),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persisted, version) =>
        migrateMeasurementFlowState(persisted, version) as MeasurementFlowStore,
      // protocolId was dropped from the persisted slice (now derived from
      // flowNodes via flowProtocolId); legacy payloads carrying it merge in
      // as an ignored extra key.
      partialize: (state) => ({
        experimentId: state.experimentId,
        loadedExperimentId: state.loadedExperimentId,
        experimentLabel: state.experimentLabel,
        workbookVersionId: state.workbookVersionId,
        executionEpoch: state.executionEpoch,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
        scanResults: state.scanResults,
        producerCellId: state.producerCellId,
        outputsByCellId: state.outputsByCellId,
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
