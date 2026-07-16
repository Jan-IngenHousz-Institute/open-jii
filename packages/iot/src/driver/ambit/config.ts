/** Ambit serial defaults (ESP32 USB-CDC console). */
export const AMBIT_SERIAL_DEFAULTS = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
} as const;

export const AMBIT_FRAMING = {
  /** Firmware reads command args with ~10ms timeouts; send everything in ONE write. */
  LINE_ENDING: "\n",
  /**
   * Replies have no framing at all, so a reply is "complete" after this much
   * RX silence. Long dumps (check, reboot) override per command.
   */
  QUIET_WINDOW_MS: 300,
  /** Overall per-command reply timeout. */
  DEFAULT_TIMEOUT: 5_000,
  /** Settle delay after a silent writer before the hello re-verify. */
  SETTLE_MS: 200,
  /** Wake handshake: poll hello until the reply carries the ready sentinel. */
  WAKE_RETRIES: 10,
  WAKE_INTERVAL_MS: 100,
  /** The firmware light-sleeps ~30s after console traffic stops. */
  SLEEP_AFTER_IDLE_MS: 20_000,
  /** `hello` replies `NEW <name> Ready`; the name is firmware-hardcoded, never trust it. */
  READY_SENTINEL: "NEW",
} as const;

export interface AmbitDriverConfig {
  /** Overall per-command reply timeout in ms (default 5000). */
  timeoutMs?: number;
  /** RX quiet window in ms that completes an unframed reply (default 300). */
  quietWindowMs?: number;
}
