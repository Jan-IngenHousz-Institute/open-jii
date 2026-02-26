import { create } from "zustand";
import { FlowNode } from "~/screens/measurement-flow-screen/types";

interface MeasurementFlowStore {
  experimentId?: string;
  protocolId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number; // Current step within the flow (0-4 for 5 steps)
  iterationCount: number; // Number of completed iterations
  isFlowFinished: boolean; // True when user explicitly finishes the flow
  scanResult?: any; // Store the scan result from measurement step
  showingOverview: boolean; // True when showing questions overview before measurement
  returnToOverviewAfterEdit: boolean; // True when editing from overview; Next returns to overview

  // Navigation
  setExperimentId: (experimentId: string) => void;
  setProtocolId: (protocolId: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentFlowStep: (step: number) => void;
  setShowingOverview: (value: boolean) => void;
  setReturnToOverviewAfterEdit: (value: boolean) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  // Flow orchestration
  setFlowNodes: (nodes: FlowNode[]) => void;
  resetFlow: () => void;
  startNewIteration: () => void;
  retryCurrentIteration: () => void;
  finishFlow: () => void;
  setScanResult: (result: any) => void;
}

export const useMeasurementFlowStore = create<MeasurementFlowStore>((set) => ({
  experimentId: undefined,
  protocolId: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,
  scanResult: undefined,
  showingOverview: false,
  returnToOverviewAfterEdit: false,

  // Experiment selection
  setExperimentId: (experimentId) => set({ experimentId }),
  setProtocolId: (protocolId) => set({ protocolId }),

  setCurrentStep: (step) => set({ currentStep: step }),
  setCurrentFlowStep: (step) => set({ currentFlowStep: step }),
  setShowingOverview: (value) => set({ showingOverview: value }),
  setReturnToOverviewAfterEdit: (value) => set({ returnToOverviewAfterEdit: value }),

  nextStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0) {
        const nextFlowStep = state.currentFlowStep + 1;
        const isCompleted = nextFlowStep >= state.flowNodes.length;
        if (isCompleted) {
          return {
            currentFlowStep: 0,
            iterationCount: state.iterationCount + 1,
            showingOverview: false,
          };
        }
        const nextNode = state.flowNodes[nextFlowStep];
        const showOverviewBeforeMeasurement = nextNode?.type === "measurement";
        return {
          currentFlowStep: nextFlowStep,
          showingOverview: showOverviewBeforeMeasurement,
        };
      }
      return { currentStep: state.currentStep + 1 };
    }),

  previousStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0 && state.currentFlowStep > 0) {
        return { currentFlowStep: state.currentFlowStep - 1 };
      }
      return { currentStep: Math.max(0, state.currentStep - 1) };
    }),

  reset: () => set({ experimentId: undefined, protocolId: undefined, currentStep: 0 }),

  // Flow orchestration
  setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0 }),

  resetFlow: () =>
    set({
      currentStep: 0,
      flowNodes: [],
      currentFlowStep: 0,
      iterationCount: 0,
      isFlowFinished: false,
      scanResult: undefined,
      protocolId: undefined,
      showingOverview: false,
      returnToOverviewAfterEdit: false,
    }),

  startNewIteration: () =>
    set((state) => {
      const nextIterationCount = state.iterationCount + 1;
      const newState = {
        currentFlowStep: 0,
        iterationCount: nextIterationCount,
        scanResult: undefined, // Clear scan result for new iteration
        // Show overview at the start of each new iteration (non-first iteration)
        showingOverview: true,
        returnToOverviewAfterEdit: false,
      };

      // Check if first step is instruction and skip it
      if (state.flowNodes.length > 0 && state.flowNodes[0]?.type === "instruction") {
        return {
          ...newState,
          currentFlowStep: 1, // Skip to second step
        };
      }

      return newState;
    }),

  retryCurrentIteration: () =>
    set(() => ({
      currentFlowStep: 0,
      scanResult: undefined, // Clear scan result for retry
    })),

  finishFlow: () =>
    set((state) => ({
      currentFlowStep: state.flowNodes.length, // Mark as completed
      isFlowFinished: true,
    })),

  setScanResult: (result) => set({ scanResult: result }),
}));
