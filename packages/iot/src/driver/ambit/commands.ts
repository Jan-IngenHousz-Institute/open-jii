/**
 * Ambit console commands, sourced from the firmware's `do_command.h`
 * (Jan-IngenHousz-Institute/ambit-iot) and the ambit-Calibratron bench tool.
 * The text console is the only host-facing contract; the binary UART protocol
 * (cmd 33 GET_INFO, arrun traces) is Ambyte-gateway-facing and out of scope.
 */

// prettier-ignore
export const AMBIT_COMMANDS = {
  // Connection / status
  HELLO:     "hello",     // "NEW <name> Ready" (name hardcoded in firmware)
  CHECK:     "check",     // multi-line hardware diagnostics
  REBOOT:    "reboot",    // ESP.restart(); boot log + config dump follows
  CLEAN_NVS: "clean_nvs", // wipe persisted calibration ("NVS cleaned")

  // Measurements
  GET_PAR:   "get_par",   // raw PAR float, then 10 CSV spectral channels
  PAR:       "PAR",       // calibrated PAR (raw x spec coeff), then channels
  TEMP:      "temp",      // "obj\tamb\tobj_r" (MLX90632, 3 floats)

  // Calibration writers (persist to NVS; the firmware replies NOTHING)
  SET_SPEC:  "set_spec",  // set_spec,<float>  PAR gain
  SET_ACT:   "set_act",   // set_act,<float>   actinic LED gain
  SET_EMIT:  "set_emit",  // set_emit,<float>
  SET_NAME:  "set_name",  // set_name,<string <=15>
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

/** Per-command overrides where the default quiet window / timeout is wrong. */
export const AMBIT_COMMAND_OVERRIDES: Record<
  string,
  { quietWindowMs?: number; timeoutMs?: number }
> = {
  // Diagnostics and reboot dumps pause mid-output for longer than the
  // default window while sensors are probed / the chip restarts.
  [AMBIT_COMMANDS.CHECK]: { quietWindowMs: 1_000, timeoutMs: 15_000 },
  [AMBIT_COMMANDS.REBOOT]: { quietWindowMs: 1_500, timeoutMs: 20_000 },
};

/** Firmware's reply to a command its hash switch does not know. */
export const AMBIT_BAD_COMMAND = "BAD COMMAND";
