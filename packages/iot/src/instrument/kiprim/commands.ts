/**
 * SCPI-style text. Setters are fire-and-forget: the supply acknowledges nothing,
 * so a write is confirmed through the reference instrument.
 */

/** Three decimals and CRLF are the firmware's format, not a preference. */
export const KIPRIM_COMMANDS = {
  IDENTIFY: "*IDN?\n",
  setVoltage: (volts: number) => `voltage ${volts.toFixed(3)}\r\n`,
  setCurrent: (amps: number) => `current ${amps.toFixed(3)}\r\n`,
} as const;

export const KIPRIM_IDENTITY_TOKEN = "KIPRIM";

/** The supply's ceilings; the guard stops a malformed procedure driving the lamp past them. */
export const KIPRIM_LIMITS = {
  CURRENT_MAX_A: 10,
  VOLTAGE_MAX_V: 32,
} as const;
