/**
 * MiniPAR console commands, sourced from the firmware's
 * `Firmware/src/app/commands.cpp` (Jan-IngenHousz-Institute/miniPar).
 *
 * The firmware is dual-mode: a plain string runs in LINE mode (raw text
 * reply); a JSON protocol (`[{"set":[{"label":"par","protocol_repeats":N}]}]`,
 * labels = these command names) replies with a MultispeQ-shaped envelope plus
 * the constant `7A1E3AA1` footer. Per-command errors appear inline as
 * `{"error":"unknown_command"}` entries.
 */

// prettier-ignore
export const MINIPAR_COMMANDS = {
  // Connection / status
  HELLO:    "hello",    // LINE: "MiniPAR,<version>,<firmware>"; JSON mode: {"device":"MiniPAR","version":...}
  STATUS:   "status",   // "model=...,available=...,atime=...,astep=...,gain=..."
  BATTERY:  "battery",  // always "NaN" (no battery)
  REBOOT:   "reboot",   // echoes "reboot" then restarts

  // Measurements
  PAR:        "par",        // calibrated PAR float
  PAR_RAW:    "par_raw",    // uncalibrated PAR float
  SPEC:       "spec",       // "<model>,ch0,...,chN" basic counts
  SPEC_RAW:   "spec_raw",   // raw counts
  SPEC_FLASH: "spec_flash", // spec_flash,<mA<=20>: "dark:...;lit:...;diff:..."
  TPH:        "tph",        // BME280 "t,p,h" CSV (blank channel = disabled)
  DELAY_MS:   "delay_ms",   // delay_ms,<n>: echo; useful inside protocols

  // Configuration
  SET_LED:        "set_led",        // set_led,<mA>: replies actual mA
  SPEC_SET_ATIME: "spec_set_atime", // 0-255 or "error:*"
  SPEC_SET_ASTEP: "spec_set_astep",
  SPEC_SET_GAIN:  "spec_set_gain",
  SET_NAME:       "set_name",       // set_name,<string <=20>
  GET_NAME:       "get_name",

  // Calibration writers
  CAL_PAR_SLOPE:     "cal_par_slope",     // cal_par_slope,<float>: echo
  CAL_PAR_INTERCEPT: "cal_par_intercept", // cal_par_intercept,<float>: echo
  SET_SPEC_COEFF:    "set_spec_coeff",    // set_spec_coeff,<ch>,<v>
  GET_SPEC_COEFF:    "get_spec_coeff",
} as const;
