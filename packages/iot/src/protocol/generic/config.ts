/**
 * Generic device configuration
 * Optional BLE service UUIDs if using Bluetooth
 */

/** Default BLE UUIDs for generic devices (can be overridden) */
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
};
