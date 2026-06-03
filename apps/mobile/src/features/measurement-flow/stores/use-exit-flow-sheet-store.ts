import { create } from "zustand";

interface ExitFlowSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useExitFlowSheetStore = create<ExitFlowSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
