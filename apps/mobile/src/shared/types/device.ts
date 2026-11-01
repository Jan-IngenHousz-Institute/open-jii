export type DeviceType = "bluetooth-classic" | "usb" | "mock-device" | "simulated-device";

export interface Device {
  type: DeviceType;
  name: string;
  id: string;
  rssi?: number;
}
