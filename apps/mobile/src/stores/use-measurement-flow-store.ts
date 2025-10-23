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

  // Experiment selection
  setExperimentId: (experimentId: string) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  // Flow orchestration
  setFlowNodes: (nodes: FlowNode[]) => void;
  nextFlowStep: () => void;
  previousFlowStep: () => void;
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

  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

  previousStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

  reset: () => set({ experimentId: undefined, currentStep: 0 }),

  // Flow orchestration
  setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0, isFlowCompleted: false }),

  nextFlowStep: () =>
    set((state) => {
      const nextStep = state.currentFlowStep + 1;
      const isCompleted = nextStep >= state.flowNodes.length;
      return {
        currentFlowStep: Math.min(nextStep, state.flowNodes.length - 1),
        isFlowCompleted: isCompleted,
      };
    }),

  previousFlowStep: () =>
    set((state) => ({
      currentFlowStep: Math.max(0, state.currentFlowStep - 1),
      isFlowCompleted: false,
    })),

  completeFlow: () => set({ isFlowCompleted: true }),

  resetFlow: () =>
    set({
      flowNodes: [],
      currentFlowStep: 0,
      isFlowCompleted: false,
    }),
}));
