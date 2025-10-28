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

  // Navigation
  setExperimentId: (experimentId: string) => void;
  setProtocolId: (protocolId: string) => void;
  setCurrentStep: (step: number) => void;
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

  // Experiment selection
  setExperimentId: (experimentId) => set({ experimentId }),
  setProtocolId: (protocolId) => set({ protocolId }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0) {
        const nextFlowStep = state.currentFlowStep + 1;
        const isCompleted = nextFlowStep >= state.flowNodes.length;
        if (isCompleted) {
          return {
            currentFlowStep: 0,
            iterationCount: state.iterationCount + 1,
          };
        }
        return { currentFlowStep: nextFlowStep };
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
    }),

  startNewIteration: () =>
    set((state) => ({
      currentFlowStep: 0,
      iterationCount: state.iterationCount + 1,
      scanResult: undefined, // Clear scan result for new iteration
    })),

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
