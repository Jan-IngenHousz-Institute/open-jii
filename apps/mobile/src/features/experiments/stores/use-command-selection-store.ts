import { create } from "zustand";

interface MeasurementStore {
  selectedCommandId?: string;
  setSelectedCommandId: (id?: string) => void;
}

export const useCommandSelectionStore = create<MeasurementStore>((set) => ({
  selectedCommandId: undefined,
  setSelectedCommandId: (selectedCommandId) => set({ selectedCommandId }),
}));
