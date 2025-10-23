import { create } from "zustand";

interface MeasurementFlowStore {
  experimentId?: string;
  currentStep: number;
  setExperimentId: (experimentId: string) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
}

export const useMeasurementFlowStore = create<MeasurementFlowStore>((set) => ({
  experimentId: undefined,
  currentStep: 0,

  setExperimentId: (experimentId) => set({ experimentId }),

  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

  previousStep: () => set((state) => ({ currentStep: Math.max(0, state.currentStep - 1) })),

  reset: () => set({ experimentId: undefined, currentStep: 0 }),
}));
