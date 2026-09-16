/**
 * Ambit console commands, sourced from the firmware's `do_command.h`
 * (Jan-IngenHousz-Institute/ambit-iot) and the factory bench that calibrates it.
 * The text console is the only host-facing contract; the binary UART protocol
 * (cmd 33 GET_INFO, arrun traces) is Ambyte-gateway-facing and out of scope.
 */
import { parseBaselineReply } from "./response-parsers";

// prettier-ignore
export const AMBIT_COMMANDS = {
  // Connection / status
  HELLO:        "hello",        // "NEW <name> Ready" (name hardcoded in firmware)
  CHECK:        "check",        // multi-line hardware diagnostics
  REBOOT:       "reboot",       // ESP.restart(); boot log + config dump follows
  CLEAN_NVS:    "clean_nvs",    // wipe persisted calibration ("NVS cleaned")

  // Measurements
  GET_PAR:      "get_par",      // raw PAR float, then 10 CSV spectral channels
  PAR:          "PAR",          // calibrated PAR (raw x spec coeff), then channels
  TEMP:         "temp",         // "obj\tamb\tobj_r" (MLX90632, 3 floats)
  ARRUN1:       "arrun1",       // arrun1,1,1,2,0,0,1,0,1,<level>,1, latches the LED, answers "Done"
  ARRUN2:       "arrun2",       // arrun2,1,0,2,0,<nh>,<nl>,<fh>,<fl>,<act>,1,\n, two lines, ADPD trace
  BASELINE:     "baseline",     // baseline,0 measures the dark vector; baseline,1 also persists it

  // Calibration writers (persist to NVS; the firmware replies NOTHING)
  SET_SPEC:     "set_spec",     // set_spec,<float>  PAR gain
  SET_ACT:      "set_act",      // set_act,<float>   actinic LED gain
  SET_EMIT:     "set_emit",     // set_emit,<float>
  SET_NAME:     "set_name",     // set_name,<string <=15>

  // Writers that do answer
  SET_CURRENTS: "set_currents", // set_currents,0,0,0,  zeroes the pulse currents
} as const;

/**
 * Commands whose reply is silence: fire, settle, then re-verify with hello.
 * Matched by prefix so `set_spec,1.234` hits `set_spec`.
 */
export const AMBIT_SILENT_COMMANDS: readonly string[] = [
  AMBIT_COMMANDS.SET_SPEC,
  AMBIT_COMMANDS.SET_ACT,
  AMBIT_COMMANDS.SET_EMIT,
  AMBIT_COMMANDS.SET_NAME,
];

/** The device kept the vector it had just measured. */
export const AMBIT_BASELINE_SAVED = "Baseline saved";

/**
 * The device refused to keep it. The dark limit belongs to the firmware, not to us: it
 * declines rather than storing a baseline measured under light.
 */
export const AMBIT_BASELINE_TOO_HIGH = "Baseline too high";

/**
 * Measure and persist in one step, which is the only way this firmware stores a baseline.
 * It keeps what it has just measured, so an approved vector cannot be sent to it.
 */
export const AMBIT_BASELINE_PERSIST = "baseline,1";

/** Ends a persisting baseline, which prints its vector first and its verdict second. */
export const baselinePersistComplete = (buffer: string): boolean =>
  buffer.includes(AMBIT_BASELINE_SAVED) || buffer.includes(AMBIT_BASELINE_TOO_HIGH);

/** Carried by the line acknowledging a `set_currents`. */
export const AMBIT_CURRENTS_SET = "Currents set";

/** Closes an `arrun1`, which runs the trace and then says so. */
export const AMBIT_RUN_DONE = "Done";

/** Closes an `arrun2` trace, after one line per channel buffer. */
export const AMBIT_TRACE_DONE = "Data sent";

/**
 * Buffer up to its last line break, so a predicate never matches text the
 * device is still writing and cuts a number in half.
 */
function completedLines(buffer: string): string {
  const lastBreak = buffer.lastIndexOf("\n");
  return lastBreak === -1 ? "" : buffer.slice(0, lastBreak);
}

export interface AmbitCommandOverride {
  quietWindowMs?: number;
  timeoutMs?: number;
  /**
   * A reply that announces its own end. The quiet window is not used for one, so a
   * pause mid-reply cannot cut it short, and a reply that never ends fails rather
   * than coming back half-collected.
   */
  isComplete?: (buffer: string) => boolean;
}

/**
 * Per-command overrides where the default quiet window / timeout is wrong, or
 * where the reply itself says when it is finished.
 */
export const AMBIT_COMMAND_OVERRIDES: Record<string, AmbitCommandOverride> = {
  // Diagnostics and reboot dumps pause mid-output for longer than the
  // default window while sensors are probed / the chip restarts.
  [AMBIT_COMMANDS.CHECK]: { quietWindowMs: 1_000, timeoutMs: 15_000 },
  [AMBIT_COMMANDS.REBOOT]: { quietWindowMs: 1_500, timeoutMs: 20_000 },

  // The device samples before it answers, and how many lines precede the vector
  // varies, so nothing but the vector may end the wait.
  [AMBIT_COMMANDS.BASELINE]: {
    isComplete: (buffer) => parseBaselineReply(completedLines(buffer)) !== null,
    timeoutMs: 25_000,
  },

  // One line per channel buffer, with the device pausing between them.
  [AMBIT_COMMANDS.ARRUN2]: {
    isComplete: (buffer) => completedLines(buffer).includes(AMBIT_TRACE_DONE),
    timeoutMs: 15_000,
  },

  [AMBIT_COMMANDS.SET_CURRENTS]: {
    isComplete: (buffer) => completedLines(buffer).includes(AMBIT_CURRENTS_SET),
  },

  // Runs the trace and prints one line when it has finished, so the wait ends on that
  // rather than on a quiet window that would return before the LED had settled.
  [AMBIT_COMMANDS.ARRUN1]: {
    isComplete: (buffer) => completedLines(buffer).includes(AMBIT_RUN_DONE),
    timeoutMs: 15_000,
  },
};

/** Firmware's reply to a command its hash switch does not know. */
export const AMBIT_BAD_COMMAND = "BAD COMMAND";
