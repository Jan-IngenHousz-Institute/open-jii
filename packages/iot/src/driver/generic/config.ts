/**
 * Generic device configuration
 * For Arduino, Raspberry Pi, custom sensors, weather stations, etc.
 * Supports BLE, Serial, and other transport types.
 */

/** Default BLE UUIDs for generic devices (Nordic UART Service, can be overridden) */
export const GENERIC_BLE_UUIDS = {
  /** Default service UUID - devices can use their own */
  SERVICE: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service

  /** Write characteristic UUID */
  WRITE: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // TX

  /** Notify characteristic UUID */
  NOTIFY: "6e400003-b5a3-f393-e0a9-e50e24dcca9e", // RX
} as const;

/** Configuration for generic device communication */
export interface GenericDeviceTransportConfig {
  /** BLE service and characteristic UUIDs (optional, for BLE devices) */
  ble?: {
    serviceUUID: string;
    writeUUID: string;
    notifyUUID: string;
  };

  /** Serial port settings (optional, for USB/Serial devices) */
  serial?: {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: "none" | "even" | "odd";
  };

  /** Response timeout in milliseconds */
  timeout?: number;

  /** Line ending for commands (default: \n) */
  lineEnding?: string;
}

/** Default serial settings for generic devices */
export const GENERIC_SERIAL_DEFAULTS = {
  baudRate: 115200,
  dataBits: 8 as const,
  stopBits: 1 as const,
  parity: "none" as const,
} as const;

/** Generic device framing constants */
export const GENERIC_FRAMING = {
  /** Command line ending */
  LINE_ENDING: "\n",

  /** Default response timeout in ms */
  DEFAULT_TIMEOUT: 10_000,
} as const;

/**
 * Shared transport-support registry for all device types.
 * Re-exported for convenience; see core/types.ts for per-device entries.
 */
export { DEVICE_TRANSPORT_SUPPORT } from "../../core/types";

/**
 * Driver-level configuration (independent of transport).
 * Pass to the `GenericDeviceDriver` constructor to override defaults.
 */
export interface GenericDriverConfig {
  /** Response timeout in milliseconds (default: 10 000) */
  timeout: number;
  /** Line ending appended to every command (default: "\n") */
  lineEnding: string;
}
