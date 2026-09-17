/**
 * Spectral tool board console: plain text, every command terminated with a carriage return.
 * Unlike the supply, the board answers each write, so a setpoint is confirmed on the wire.
 */

/** Mixed casing is the board's own: `setled` is lower case where the rest are not. */
export const CALITOOL_COMMANDS = {
  /**
   * The only command written to a port before anything is known about it. The board ends a
   * line on either terminator, while a console that ends on the newline alone discards the
   * carriage return and would hold this as a partial command, reading the next instrument's
   * probe fused onto it. The newline is the one terminator both accept, and it leaves no
   * empty second line for the board to parse as a command of its own.
   */
  IDENTIFY: "*IDN?\n",
  MEASURE: "measure\r",
  setLed: (milliamps: number) => `setled ${milliamps}\r`,
  setGain: (gain: number) => `setGain ${gain}\r`,
  setAtime: (atime: number) => `setAtime ${atime}\r`,
  setAstep: (astep: number) => `setAstep ${astep}\r`,
  getChannel: (channel: number) => `get ${channel}\r`,
} as const;

export const CALITOOL_IDENTITY_TOKEN = "CaliTool";

/** Every command but the identity query answers with this. */
export const CALITOOL_ACK = "OK";

/** The greeting runs to three lines and the identity is not always the first of them. */
export const CALITOOL_IDENTITY_LINES = 3;

export const CALITOOL_LIMITS = {
  LED_MAX_MA: 250,
  GAIN_MAX: 10,
  ATIME_MIN: 1,
  ATIME_MAX: 255,
  ASTEP_MIN: 1,
  ASTEP_MAX: 65535,
  CHANNEL_COUNT: 12,
} as const;
