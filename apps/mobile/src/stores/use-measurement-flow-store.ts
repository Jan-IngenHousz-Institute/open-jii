import { create } from "zustand";
import { FlowNode } from "~/screens/measurement-flow-screen/types";

interface MeasurementFlowStore {
  experimentId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number; // Current step within the flow (0-4 for 5 steps)
  iterationCount: number; // Number of completed iterations
  isFlowFinished: boolean; // True when user explicitly finishes the flow

  // Navigation
  setExperimentId: (experimentId: string) => void;
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
}

export const useMeasurementFlowStore = create<MeasurementFlowStore>((set) => ({
  experimentId: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,

  // Experiment selection
  setExperimentId: (experimentId) => set({ experimentId }),

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
        } else {
          return { currentFlowStep: nextFlowStep };
        }
      } else {
        return { currentStep: state.currentStep + 1 };
      }
    }),

  previousStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0 && state.currentFlowStep > 0) {
        return { currentFlowStep: state.currentFlowStep - 1 };
      } else {
        return { currentStep: Math.max(0, state.currentStep - 1) };
      }
    }),

  reset: () => set({ experimentId: undefined, currentStep: 0 }),

  // Flow orchestration
  setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0 }),

  resetFlow: () =>
    set({
      currentStep: 0,
      flowNodes: [],
      currentFlowStep: 0,
      iterationCount: 0,
      isFlowFinished: false,
    }),

  startNewIteration: () =>
    set((state) => ({
      currentFlowStep: 0,
      iterationCount: state.iterationCount + 1,
    })),

  retryCurrentIteration: () =>
    set(() => ({
      currentFlowStep: 0,
    })),

  finishFlow: () =>
    set((state) => ({
      currentFlowStep: state.flowNodes.length, // Mark as completed
      isFlowFinished: true,
    })),
}));
