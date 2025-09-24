import { create } from "zustand";
import { ProtocolName } from "~/protocols/definitions";

interface MeasurementStore {
  selectedProtocolName?: ProtocolName;
  setSelectedProtocolName: (name?: ProtocolName) => void;
}

export const useProtocolSelectionStore = create<MeasurementStore>((set) => ({
  selectedProtocolName: undefined,
  setSelectedProtocolName: (name) => set({ selectedProtocolName: name }),
}));
