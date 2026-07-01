import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Device } from "~/shared/types/device";

interface DeviceConnectionStore {
  /** The last successfully connected device, used for inline reconnect in the measurement flow. */
  lastConnectedDevice: Device | undefined;
  setLastConnectedDevice: (device: Device | undefined) => void;
}

// Live connection state belongs to the connected-device query (see
// connection-keys.ts); battery comes from useBatteryLevel. This store only
// remembers the last device across launches.
export const useDeviceConnectionStore = create<DeviceConnectionStore>()(
  persist(
    (set) => ({
      lastConnectedDevice: undefined,
      setLastConnectedDevice: (device) => set({ lastConnectedDevice: device }),
    }),
    {
      name: "device-connection-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastConnectedDevice: state.lastConnectedDevice }),
    },
  ),
);
