import { create } from "zustand";

interface DeviceSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useDeviceSheetStore = create<DeviceSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
