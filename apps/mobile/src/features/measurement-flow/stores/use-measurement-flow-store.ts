import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
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
} from "~/features/measurement-flow/domain/flow-transitions";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

interface MeasurementFlowStore extends FlowState {
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
  setFlowGraph: (nodes: FlowNode[], edges: FlowEdge[], cells: WorkbookCell[]) => void;
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
  setIterationAnchor: (anchor: { iteration: number; nodeId?: string }) => void;
  dismissQuestionsSubmit: () => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
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

      setExperimentId: (experimentId, experimentLabel) => set({ experimentId, experimentLabel }),

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentFlowStep: (step) => set({ currentFlowStep: step }),

      nextStep: () => set(nextStepState),
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

      setFlowGraph: (nodes, edges, cells) =>
        set({
          flowNodes: nodes,
          edges,
          cells,
          currentFlowStep: 0,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
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

      resetFlow: () => set({ ...resetFlowState(), iterationAnchor: undefined }),

      startNewIteration: () => set(startNewIterationState),

      retryCurrentIteration: () => set(retryIterationState()),

      finishFlow: () => set(finishFlowState),

      setScanResult: (result, producerCellId) =>
        set({
          scanResult: result,
          scanResults: result === undefined ? undefined : [{ result }],
          producerCellId,
        }),

      setScanResults: (results, producerCellId) =>
        set({ scanResults: results, scanResult: results[0]?.result, producerCellId }),
      setIterationAnchor: (anchor) => set({ iterationAnchor: anchor }),

      dismissQuestionsSubmit: () => set(dismissQuestionsSubmitState),

      navigateToQuestionFromOverview: (questionIndex) =>
        set(navigateToQuestionFromOverviewState(questionIndex)),

      returnToOverview: () => set(returnToOverviewState),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 wire format, pinned by flow-store-persistence.test.ts. v1 discards
      // flows persisted by pre-fix (v0) builds, which can hold a mis-seeded
      // plot or a stale "Experiment" name; the upgrade starts them clean.
      version: 1,
      migrate: (persisted, version) =>
        (version < 1 ? initialFlowState : persisted) as MeasurementFlowStore,
      // protocolId was dropped from the persisted slice (now derived from
      // flowNodes via flowProtocolId); legacy payloads carrying it merge in
      // as an ignored extra key.
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
        scanResults: state.scanResults,
        producerCellId: state.producerCellId,
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
