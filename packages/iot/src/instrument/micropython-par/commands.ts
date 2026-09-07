/**
 * A PAR reference photodiode read through a MicroPython board's REPL.
 *
 * There is no device protocol: the board runs a script that defines
 * `getPAR()`, and the console is a Python prompt. Discovery enters raw REPL
 * with Ctrl-A, which every MicroPython board acknowledges with the same
 * banner, then Ctrl-B returns to the friendly prompt and Ctrl-D soft-reboots
 * so the board's own script is running again before the first read.
 */

export const MICROPYTHON_COMMANDS = {
  /** Ctrl-A: enter raw REPL. The board answers with the raw-REPL banner. */
  ENTER_RAW: "\x01",
  /** Ctrl-B then Ctrl-D: back to the friendly prompt, then soft reboot. */
  LEAVE_RAW_AND_REBOOT: "\x02\x04",
  /** The board echoes the line, then prints the value on the next one. */
  GET_PAR: "getPAR()\r",
} as const;

/**
 * Substring of the raw-REPL banner. Weak by nature: any MicroPython board
 * answers Ctrl-A this way, so a rig with two such boards cannot tell them
 * apart by handshake alone.
 */
export const MICROPYTHON_IDENTITY_TOKEN = "raw REPL";
