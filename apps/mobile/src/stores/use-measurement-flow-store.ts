import { create } from "zustand";

interface FlowNode {
  id: string;
  type: "instruction" | "question" | "measurement" | "analysis";
  content: any;
}

interface MeasurementFlowStore {
  experimentId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number; // Current step within the flow (0-4 for 5 steps)
  isFlowCompleted: boolean;

  // Navigation
  setExperimentId: (experimentId: string) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  // Flow orchestration
  setFlowNodes: (nodes: FlowNode[]) => void;
  completeFlow: () => void;
  resetFlow: () => void;
}

export const useMeasurementFlowStore = create<MeasurementFlowStore>((set) => ({
  experimentId: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  isFlowCompleted: false,

  // Experiment selection
  setExperimentId: (experimentId) => set({ experimentId }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0) {
        const nextFlowStep = state.currentFlowStep + 1;
        const isCompleted = nextFlowStep >= state.flowNodes.length;
        return {
          currentFlowStep: isCompleted ? state.flowNodes.length : nextFlowStep,
          isFlowCompleted: isCompleted,
        };
      } else {
        return { currentStep: state.currentStep + 1 };
      }
    }),

  previousStep: () =>
    set((state) => {
      if (state.currentStep > 0 && state.flowNodes.length > 0 && state.currentFlowStep > 0) {
        return { currentFlowStep: state.currentFlowStep - 1, isFlowCompleted: false };
      } else {
        return { currentStep: Math.max(0, state.currentStep - 1) };
      }
    }),

  reset: () => set({ experimentId: undefined, currentStep: 0 }),

  // Flow orchestration
  setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0, isFlowCompleted: false }),

  completeFlow: () => set({ isFlowCompleted: true }),

  resetFlow: () =>
    set({
      flowNodes: [],
      currentFlowStep: 0,
      isFlowCompleted: false,
    }),
}));
