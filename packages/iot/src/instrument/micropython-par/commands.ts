/**
 * A PAR photodiode read through a MicroPython REPL: no device protocol, the board's
 * script defines getPAR() and the console is a Python prompt.
 */

export const MICROPYTHON_COMMANDS = {
  /** Ctrl-A: enter raw REPL. The board answers with the raw-REPL banner. */
  ENTER_RAW: "\x01",
  /** Ctrl-B then Ctrl-D: back to the friendly prompt, then soft reboot. */
  LEAVE_RAW_AND_REBOOT: "\x02\x04",
  /** The board echoes the line, then prints the value on the next one. */
  GET_PAR: "getPAR()\r",
} as const;

/** Weak by nature: any MicroPython board answers Ctrl-A this way. */
export const MICROPYTHON_IDENTITY_TOKEN = "raw REPL";
