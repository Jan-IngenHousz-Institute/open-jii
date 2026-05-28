import { create } from "zustand";

interface MacroSelectionStore {
  selectedMacroId?: string;
  setSelectedMacroId: (id?: string) => void;
}

export const useMacroSelectionStore = create<MacroSelectionStore>((set) => ({
  selectedMacroId: undefined,
  setSelectedMacroId: (id) => set({ selectedMacroId: id }),
}));
