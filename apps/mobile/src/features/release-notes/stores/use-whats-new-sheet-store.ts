import { create } from "zustand";

interface WhatsNewSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Drives the What's new full-screen drawer; mirrors useDeviceSheetStore. */
export const useWhatsNewSheetStore = create<WhatsNewSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
