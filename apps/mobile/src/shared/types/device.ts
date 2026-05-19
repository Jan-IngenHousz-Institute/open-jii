export type DeviceType = "bluetooth-classic" | "ble" | "usb" | "mock-device";

export interface Device {
  type: DeviceType;
  name: string;
  id: string;
  rssi?: number;
}
