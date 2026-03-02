/**
 * MultispeQ Driver Configuration
 *
 * MultispeQ devices communicate via Bluetooth Classic or USB Serial only (no BLE support).
 * Commands are sent as strings terminated with \r\n.
 * Responses are newline-terminated, with an 8-character checksum appended before the newline.
 */

/** MultispeQ serial port defaults (for USB Serial connections) */
export const MULTISPEQ_SERIAL_DEFAULTS = {
  baudRate: 115200,
  dataBits: 8 as const,
  stopBits: 1 as const,
  parity: "none" as const,
} as const;

/** MultispeQ transport configuration */
export interface MultispeqTransportConfig {
  /** Serial port settings (for USB Serial connections) */
  serial?: {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: "none" | "even" | "odd";
  };

  /** Response timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/** MultispeQ framing constants */
export const MULTISPEQ_FRAMING = {
  /** Command line ending */
  LINE_ENDING: "\r\n",

  /** Length of checksum appended to responses */
  CHECKSUM_LENGTH: 8,

  /** Default response timeout in ms */
  DEFAULT_TIMEOUT: 30_000,
} as const;

/** Supported MultispeQ transport types */
export type MultispeqTransportType = "bluetooth-classic" | "usb";
