/** MiniPAR serial defaults (ESP32 USB-CDC console). */
export const MINIPAR_SERIAL_DEFAULTS = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
} as const;

export const MINIPAR_FRAMING = {
  LINE_ENDING: "\n",
  /**
   * JSON-mode replies end with this constant sentinel before the newline
   * (a fixed footer, not a computed checksum).
   */
  FRAME_FOOTER: "7A1E3AA1",
  FOOTER_LENGTH: 8,
  /** LINE-mode command timeout. */
  DEFAULT_TIMEOUT: 10_000,
  /** JSON protocol timeout; no estimator exists for MiniPAR protocols yet. */
  PROTOCOL_TIMEOUT: 60_000,
} as const;

export interface MiniParDriverConfig {
  /** LINE-mode reply timeout in ms (default 10000). */
  timeoutMs?: number;
  /** JSON protocol reply timeout in ms (default 60000). */
  protocolTimeoutMs?: number;
}
