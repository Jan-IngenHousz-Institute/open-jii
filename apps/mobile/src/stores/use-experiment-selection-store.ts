import { create } from "zustand";

interface ExperimentSelectionStore {
  selectedExperimentId?: string;
  setSelectedExperimentId: (id?: string) => void;
}

export const useExperimentSelectionStore = create<ExperimentSelectionStore>((set) => ({
  selectedExperimentId: undefined,
  setSelectedExperimentId: (id) => set({ selectedExperimentId: id }),
}));
