/**
 * Core device types
 */

/** Supported transport types */
export type TransportType = "bluetooth-classic" | "ble" | "usb" | "web-bluetooth" | "web-serial";

/** Supported device types */
export type DeviceType = "multispeq" | "generic";

/** Generic device information */
export interface Device {
  /** Device unique identifier (MAC address, serial number, etc.) */
  id: string;
  /** Human-readable device name */
  name: string;
  /** Transport type used for connection */
  transportType: TransportType;
  /** Device type (protocol handler) */
  deviceType: DeviceType;
  /** Signal strength (for wireless connections) */
  rssi?: number;
}

/** Device connection status */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** Device connection info */
export interface DeviceConnectionInfo {
  device: Device;
  status: ConnectionStatus;
  batteryLevel?: number;
  error?: Error;
}
