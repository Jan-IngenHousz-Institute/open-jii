import { create } from "zustand";
import type { Device } from "~/types/device";

export type ConnectionType = "usb" | "bluetooth-classic" | "mock-device" | "ble";
export type DeviceType = "multispeq";

interface DeviceConnectionState {
  connectionType: ConnectionType | undefined;
  deviceType: DeviceType | undefined;
  batteryLevel: number | undefined;
  deviceName: string | undefined;
  /** The last successfully connected device, used for inline reconnect in the measurement flow. */
  lastConnectedDevice: Device | undefined;
}

interface DeviceConnectionActions {
  setConnectionType: (connectionType: ConnectionType | undefined) => void;
  setDeviceType: (deviceType: DeviceType | undefined) => void;
  setBatteryLevel: (batteryLevel: number | undefined) => void;
  setDeviceName: (deviceName: string | undefined) => void;
  setDeviceInfo: (info: Partial<DeviceConnectionState>) => void;
  setLastConnectedDevice: (device: Device | undefined) => void;
  clearConnection: () => void;
}

export const useDeviceConnectionStore = create<DeviceConnectionState & DeviceConnectionActions>()(
  (set) => ({
    // State
    connectionType: undefined,
    deviceType: undefined,
    batteryLevel: undefined,
    deviceName: undefined,
    lastConnectedDevice: undefined,

    // Actions
    setConnectionType: (connectionType) => set({ connectionType }),
    setDeviceType: (deviceType) => set({ deviceType }),
    setBatteryLevel: (batteryLevel) => set({ batteryLevel }),
    setDeviceName: (deviceName) => set({ deviceName }),
    setLastConnectedDevice: (device) => set({ lastConnectedDevice: device }),

    setDeviceInfo: (info) => set((state) => ({ ...state, ...info })),

    clearConnection: () =>
      set({
        connectionType: undefined,
        deviceType: undefined,
        batteryLevel: undefined,
        deviceName: undefined,
      }),
  }),
);
