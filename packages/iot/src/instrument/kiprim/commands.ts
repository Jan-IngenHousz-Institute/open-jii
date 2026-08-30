/**
 * Kiprim DC source wire protocol.
 *
 * SCPI-style text. The setters are fire-and-forget: the supply acknowledges
 * nothing, so a write is confirmed by reading back through the reference
 * instrument rather than by a reply. `*IDN?` is the only query, and its answer
 * is what identifies the box on a serial port.
 */

/** Three decimals and CRLF are the firmware's format, not a preference. */
export const KIPRIM_COMMANDS = {
  IDENTIFY: "*IDN?\n",
  setVoltage: (volts: number) => `voltage ${volts.toFixed(3)}\r\n`,
  setCurrent: (amps: number) => `current ${amps.toFixed(3)}\r\n`,
} as const;

/** Substring the `*IDN?` reply carries, and what a procedure handshakes on. */
export const KIPRIM_IDENTITY_TOKEN = "KIPRIM";

/**
 * Setpoint ceilings. The lamp sweep tops out at 6.6 A in the Ambit factory
 * procedure; the headroom here is the supply's, and the guard exists so a
 * malformed procedure cannot drive a calibration lamp past it.
 */
export const KIPRIM_LIMITS = {
  CURRENT_MAX_A: 10,
  VOLTAGE_MAX_V: 32,
} as const;
