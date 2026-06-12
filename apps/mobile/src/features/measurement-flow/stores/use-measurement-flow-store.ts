import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  FlowEdge,
  FlowNode,
  isQuestionsOnlyFlow,
} from "~/features/measurement-flow/screens/measurement-flow-screen/types";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

/** The branch path the flow last routed through, surfaced inline in the hero. */
export interface MatchedPath {
  label: string;
  color: string;
}

/** A branch jump: its landing node index and the step Back should return to. */
export interface BranchReturn {
  landing: number;
  step: number;
}

interface MeasurementFlowStore {
  experimentId?: string;
  experimentLabel?: string;
  protocolId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  isFlowFinished: boolean;
  isQuestionsSubmitPending: boolean;
  scanResult?: any;
  isFromOverview: boolean;

  // Workbook-derived data, used to evaluate branch cells on-device. Empty for
  // legacy flow-only experiments (no workbook attached).
  cells: WorkbookCell[];
  edges: FlowEdge[];
  // Which branch path was last taken (for the inline hero chip).
  lastMatchedPath?: MatchedPath;
  // Per-node visit counter that caps branch goto-loops (mirrors web's MAX_VISITS_PER_CELL).
  branchVisitCounts: Record<string, number>;
  // Stack of branch jumps so Back unwinds non-linear routing instead of
  // stepping into nodes the matched path skipped.
  branchReturnStack: BranchReturn[];

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
  setScanResult: (result: any) => void;
  dismissQuestionsSubmit: () => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
}

// The store is persisted so a mid-flow blur (background, kill, tab switch)
// is itself the "pause": the next launch rehydrates the same active flow
// and the home screen renders the resume card based on whether experimentId
// is set. No separate snapshot store needed. The workbook cells/edges and
// branch state are persisted too so a resumed branching flow keeps evaluating
// offline.
export const useMeasurementFlowStore = create<MeasurementFlowStore>()(
  persist(
    (set, get) => ({
      experimentId: undefined,
      experimentLabel: undefined,
      protocolId: undefined,
      currentStep: 0,
      flowNodes: [],
      currentFlowStep: 0,
      iterationCount: 0,
      isFlowFinished: false,
      isQuestionsSubmitPending: false,
      scanResult: undefined,
      isFromOverview: false,
      cells: [],
      edges: [],
      lastMatchedPath: undefined,
      branchVisitCounts: {},
      branchReturnStack: [],

      setExperimentId: (experimentId, experimentLabel) => set({ experimentId, experimentLabel }),
      setProtocolId: (protocolId) => set({ protocolId }),

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentFlowStep: (step) => set({ currentFlowStep: step }),

      nextStep: () =>
        set((state) => {
          if (state.isFromOverview) {
            return {
              currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
              isFromOverview: false,
            };
          }
          if (state.experimentId && state.flowNodes.length > 0) {
            const nextFlowStep = state.currentFlowStep + 1;
            const isCompleted = nextFlowStep >= state.flowNodes.length;
            if (isCompleted) {
              if (isQuestionsOnlyFlow(state.flowNodes)) {
                return {
                  isQuestionsSubmitPending: true,
                  currentFlowStep: state.flowNodes.length,
                };
              }
              return {
                currentFlowStep: 0,
                iterationCount: state.iterationCount + 1,
                branchVisitCounts: {},
                lastMatchedPath: undefined,
                branchReturnStack: [],
              };
            }
            return { currentFlowStep: nextFlowStep };
          }
          return { currentStep: state.currentStep + 1 };
        }),

      previousStep: () =>
        set((state) => {
          if (state.isFromOverview) {
            return {
              currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
              isFromOverview: false,
            };
          }
          if (state.experimentId && state.flowNodes.length > 0) {
            if (state.isQuestionsSubmitPending) {
              return {
                isQuestionsSubmitPending: false,
                currentFlowStep: state.flowNodes.length - 1,
              };
            }
            // If we arrived here via a branch jump, unwind the jump (return to
            // the step before the branch) rather than stepping linearly into a
            // node the matched path skipped.
            const branchReturn = state.branchReturnStack[state.branchReturnStack.length - 1];
            const isBranchReturn = !!branchReturn && branchReturn.landing === state.currentFlowStep;
            if (isBranchReturn && branchReturn.step >= 0) {
              return {
                currentFlowStep: branchReturn.step,
                branchReturnStack: state.branchReturnStack.slice(0, -1),
              };
            }
            if (state.currentFlowStep > 0 && !isBranchReturn) {
              return { currentFlowStep: state.currentFlowStep - 1 };
            } else {
              return {
                experimentId: undefined,
                experimentLabel: undefined,
                currentStep: 0,
                flowNodes: [],
                currentFlowStep: 0,
                iterationCount: 0,
                isFlowFinished: false,
                isQuestionsSubmitPending: false,
                scanResult: undefined,
                protocolId: undefined,
                cells: [],
                edges: [],
                branchVisitCounts: {},
                lastMatchedPath: undefined,
                branchReturnStack: [],
              };
            }
          }
          return { currentStep: Math.max(0, state.currentStep - 1) };
        }),

      // Route through resetFlow so the persisted slice (flowNodes,
      // currentFlowStep, iterationCount, scanResult, …) is cleared too.
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

      // Records where Back should land after a branch jumps to `landing`. Called
      // with currentFlowStep still on the branch node. A branch reached via a
      // prior jump (a transparent chained branch) inherits that jump's return
      // and replaces it; otherwise Back returns to the step before this branch.
      recordBranchJump: (landing) =>
        set((state) => {
          const stack = state.branchReturnStack;
          const top = stack[stack.length - 1];
          if (top?.landing === state.currentFlowStep) {
            return {
              branchReturnStack: [...stack.slice(0, -1), { landing, step: top.step }],
            };
          }
          return {
            branchReturnStack: [...stack, { landing, step: state.currentFlowStep - 1 }],
          };
        }),

      resetFlow: () =>
        set({
          experimentId: undefined,
          experimentLabel: undefined,
          currentStep: 0,
          flowNodes: [],
          currentFlowStep: 0,
          iterationCount: 0,
          isFlowFinished: false,
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          protocolId: undefined,
          isFromOverview: false,
          cells: [],
          edges: [],
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        }),

      startNewIteration: () =>
        set((state) => ({
          currentFlowStep: 0,
          iterationCount: state.iterationCount + 1,
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          isFromOverview: false,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        })),

      retryCurrentIteration: () =>
        set(() => ({
          currentFlowStep: 0,
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          isFromOverview: false,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        })),

      finishFlow: () =>
        set((state) => ({
          currentFlowStep: state.flowNodes.length,
          isFlowFinished: true,
          isQuestionsSubmitPending: false,
          isFromOverview: false,
        })),

      setScanResult: (result) => set({ scanResult: result }),

      dismissQuestionsSubmit: () =>
        set((state) => ({
          isQuestionsSubmitPending: false,
          currentFlowStep: 0,
          iterationCount: state.iterationCount + 1,
          scanResult: undefined,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        })),

      navigateToQuestionFromOverview: (questionIndex) =>
        set({
          currentFlowStep: questionIndex,
          isFromOverview: true,
          isQuestionsSubmitPending: false,
          branchReturnStack: [],
        }),

      returnToOverview: () =>
        set((state) => {
          if (isQuestionsOnlyFlow(state.flowNodes)) {
            return {
              isQuestionsSubmitPending: true,
              isFromOverview: false,
              branchReturnStack: [],
            };
          }
          return {
            currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
            isFromOverview: false,
            branchReturnStack: [],
          };
        }),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
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
