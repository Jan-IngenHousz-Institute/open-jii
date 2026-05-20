import { create } from "zustand";

interface MeasurementStore {
  selectedProtocolId?: string;
  setSelectedProtocolId: (id?: string) => void;
}

export const useProtocolSelectionStore = create<MeasurementStore>((set) => ({
  selectedProtocolId: undefined,
  setSelectedProtocolId: (selectedProtocolId) => set({ selectedProtocolId }),
}));
