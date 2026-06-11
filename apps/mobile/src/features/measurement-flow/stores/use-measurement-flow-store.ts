import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  FlowState,
  MatchedPath,
  ScanResult,
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

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

interface MeasurementFlowStore extends FlowState {
  // AutoProceededSummary anchor: first manual question at the start of the
  // current iteration (set by useIterationStateSync). Deliberately NOT
  // persisted; on relaunch it is recomputed by the resume-path sync.
  iterationAnchor?: { iteration: number; nodeId?: string };

  setExperimentId: (experimentId: string, experimentLabel?: string) => void;
  setProtocolId: (protocolId: string) => void;
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
  setScanResult: (result: ScanResult | undefined) => void;
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
      setProtocolId: (protocolId) => set({ protocolId }),

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

      setScanResult: (result) => set({ scanResult: result }),
      setIterationAnchor: (anchor) => set({ iterationAnchor: anchor }),

      dismissQuestionsSubmit: () => set(dismissQuestionsSubmitState),

      navigateToQuestionFromOverview: (questionIndex) =>
        set(navigateToQuestionFromOverviewState(questionIndex)),

      returnToOverview: () => set(returnToOverviewState),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v0 wire format, pinned by flow-store-persistence.test.ts. NEVER
      // rename/remove a field without bumping `version` + a real `migrate`:
      // zustand silently DROPS persisted state on version mismatch, wiping a
      // researcher's paused flow.
      version: 0,
      migrate: (persisted) => persisted as MeasurementFlowStore,
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        protocolId: state.protocolId,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
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
