import { create } from "zustand";

export type ConnectionType = "usb" | "bluetooth-classic" | "mock-device" | "ble";
export type DeviceType = "multispeq";

interface DeviceConnectionState {
  connectionType: ConnectionType | undefined;
  deviceType: DeviceType | undefined;
  batteryLevel: number | undefined;
  deviceName: string | undefined;
}

interface DeviceConnectionActions {
  setConnectionType: (connectionType: ConnectionType | undefined) => void;
  setDeviceType: (deviceType: DeviceType | undefined) => void;
  setBatteryLevel: (batteryLevel: number | undefined) => void;
  setDeviceName: (deviceName: string | undefined) => void;
  setDeviceInfo: (info: Partial<DeviceConnectionState>) => void;
  clearConnection: () => void;
}

export const useDeviceConnectionStore = create<DeviceConnectionState & DeviceConnectionActions>()(
  (set) => ({
    // State
    connectionType: undefined,
    deviceType: undefined,
    batteryLevel: undefined,
    deviceName: undefined,

    // Actions
    setConnectionType: (connectionType) => set({ connectionType }),
    setDeviceType: (deviceType) => set({ deviceType }),
    setBatteryLevel: (batteryLevel) => set({ batteryLevel }),
    setDeviceName: (deviceName) => set({ deviceName }),
    
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
