/**
 * MultispeQ console commands
 *
 * Sourced from PhotosynQ documentation.
 *
 * The device also accepts entity-protocol JSON (Record<string, unknown>[])
 * for measurements — those are sent directly via execute() and not listed here.
 */

// ─── Console control sequences ───────────────────────────────────────────────

// prettier-ignore
export const MULTISPEQ_CONSOLE = {
  SILENT:  "s+",  // suppress interactive queries
  VERBOSE: "v+",  // enable interactive queries
  CANCEL:  "-1+", // cancel a continuous-output command (e.g. hall, 1053)
} as const;

// ─── Commands shared across all firmware versions ────────────────────────────

// prettier-ignore
const MULTISPEQ_COMMANDS_BASE = {
  // Connection / Status
  HELLO:   "hello",   // responds "Instrument Ready" (alias: 1000)
  BATTERY: "battery", // charge in percent
  SLEEP:   "sleep",   // hold button 5 s to wake
  RESET:   "reset",   // reboot (alias: 1027)
  REBOOT:  "reboot",

  // Device info
  DEVICE_INFO:     "device_info",     // name, version, id, battery, firmware, config (alias: 1007)
  SET_DEVICE_INFO: "set_device_info", // (alias: 1008)
  COMPILED:        "compiled",        // firmware compile date/time
  MEMORY:          "memory",

  // Sensors
  TEMP:     "temp", // temperature + relative humidity (BME280)
  HALL:     "hall", // continuous hall sensor (cancel with -1+)
  IMU_FEED: "1053", // continuous roll, pitch, compass, direction, tilt (cancel with -1+)

  // Calibration / EEPROM
  PRINT_ALL:              "print_all",              // all EEPROM values
  PRINT_MEMORY:           "print_memory",           // calibrations as JSON with checksum
  PRINT_DATE:             "print_date",             // RTC date
  PRINT_MAGNETOMETER:     "print_magnetometer",
  PRINT_MAGNETOMETER_BIAS:"print_magnetometer_bias",
  SET_ACCELEROMETER:      "set_accelerometer",
  SET_ACCELEROMETER_BIAS: "set_accelerometer_bias",
  SET_COLORCAL1:          "set_colorcal1",          // color calibration channel 1
  SET_COLORCAL2:          "set_colorcal2",          // color calibration channel 2
  SET_COLORCAL3:          "set_colorcal3",          // color calibration channel 3
  SET_COLORCAL_BLANKS:    "set_colorcal_blanks",
  SET_DAC:                "set_dac",                // DAC addresses (1, 2, 3)
  SET_DATE:               "set_date",               // format: set_date+hours+min+sec+day+month+year
  SET_DETECTOR1_OFFSET:   "set_detector1_offset",
  SET_DETECTOR2_OFFSET:   "set_detector2_offset",
  SET_DETECTOR3_OFFSET:   "set_detector3_offset",
  SET_DETECTOR4_OFFSET:   "set_detector4_offset",
  SET_LED_PAR:            "set_led_par",
  SET_MAGNETOMETER:       "set_magnetometer",
  SET_MAGNETOMETER_BIAS:  "set_magnetometer_bias",
  SET_PAR:                "set_par",
  SET_SERIAL:             "set_serial",
  SET_THICKNESS:          "set_thickness",
  SET_THICKNESS_QUICK:    "set_thickness_quick",
  SET_USER_DEFINED:       "set_user_defined",       // set_user_defined+<location>+<value>

  // LED / Light
  LIGHT: "light", // turn on 5 V light: light<number>
  ON_5V: "on_5v", // turn on 5 V for 30 s

  // Hardware / I2C
  SCAN_I2C:   "scan_i2c",
  READONCE:   "readonce",   // write-once flash
  TCS_LENGTH: "tcs_length",

  // Testing / Debug
  TESTMODE:       "testmode",
  SINGLE_PULSE:   "single_pulse",   // LED noise analysis (testmode only)
  P2P:            "p2p",            // pulse-to-pulse linearity / stdev
  PULSE:          "pulse",
  PAR_LED:        "par_led",
  EXPR:           "expr",           // expression evaluator
  START_WATCHDOG: "start_watchdog",
  STOP_WATCHDOG:  "stop_watchdog",

  // Bluetooth
  CONFIGURE_BLUETOOTH: "configure_bluetooth", // set name + baud rate

  // Firmware
  UPGRADE: "upgrade", // OTA update (alias: 1078)
} as const;

// ─── v1.17-only commands (MultispeQ 1) ───────────────────────────────────────

// prettier-ignore
const MULTISPEQ_V1_ONLY = {
  IMU_1054:              "1054",
  LINEARITY_4048:        "4048",                  // replaced by p2p in v2
  ADC1:                  "adc1",
  ADC_CHECK:             "adc_check",
  ALL_SENSORS:           "all_sensors",            // continuous (cancel with -1+)
  ANY_LIGHT:             "any_light",
  CALIBRATE_COMPASS:     "calibrate_compass",
  CALIBRATE_LEDS:        "calibrate_leds",
  CALIBRATE_LEDS_MANUAL: "calibrate_leds_manual",
  CONSTANT_LIGHT:        "constant_light",         // continuous (cancel with -1+)
  CUT_THROUGH:           "cut_through",
  CYCLE5V:               "cycle5v",
  DAC50:                 "dac50",                  // all DAC outputs to 50 %
  FEED_WATCHDOG:         "feed_watchdog",
  GET_CO2:               "get_co2",                // Sensirion S8 CO₂ (Serial Port 3)
} as const;

// ─── v2-only commands (MultispeQ 1 + 2) ─────────────────────────────────────

// prettier-ignore
const MULTISPEQ_V2_ONLY = {
  // Connection / Status
  USB: "usb", // check if connected via USB

  // Flow
  SET_FLOW:                   "set_flow",
  GET_FLOW:                   "get_flow",
  FLOW_OFF:                   "flow_off",
  FLOW_V:                     "flow_v",                     // velocity
  FLOW_CALIBRATION_SET_POINT: "flow_calibration_set_point", // alias: fcsp
  FLOW_CALIBRATION_SETTING:   "flow_calibration_setting",   // alias: fcv
  FLOW_CALIBRATION_VALUE:     "flow_calibration_value",     // alias: fcv
  RESET_FLOW_CALIBRATION:     "reset_flow_calibration",     // factory settings
  RESET_FLOW_ZERO_POINT:      "reset_flow_zero_point",
  SET_DEFAULT_FLOW_RATE:      "set_default_flow_rate",

  // LED / Indicator
  INDICATE:     "indicate",     // RGB: indicate+<R>+<G>+<B> (0–255)
  INDICATE_OFF: "indicate_off",

  // Hardware
  DIGITAL_WRITE: "digital_write", // dangerous — direct pin write

  // Clamp positions (added v2.0038)
  SET_CP:                    "set_cp",                    // close position
  SET_OP:                    "set_op",                    // open position
  SET_OPEN_CLOSED_POSITIONS: "set_open_closed_positions",

  // Power / Timing
  SET_ENERGY_SAVE_TIME: "set_energy_save_time",
  SET_SHUTDOWN_TIME:    "set_shutdown_time",    // auto-shutdown in seconds
} as const;

// ─── Full version-specific command maps ──────────────────────────────────────

/** Complete command set for firmware v1.17 (MultispeQ 1 only) */
export const MULTISPEQ_COMMANDS_V1 = {
  ...MULTISPEQ_COMMANDS_BASE,
  ...MULTISPEQ_V1_ONLY,
} as const;

/** Complete command set for firmware v2.003x (MultispeQ 1 + 2) */
export const MULTISPEQ_COMMANDS_V2 = {
  ...MULTISPEQ_COMMANDS_BASE,
  ...MULTISPEQ_V2_ONLY,
} as const;

/** Alias for the latest version (v2) */
export const MULTISPEQ_COMMANDS = MULTISPEQ_COMMANDS_V2;

// ─── Types ───────────────────────────────────────────────────────────────────

export type MultispeqCommandV1 = (typeof MULTISPEQ_COMMANDS_V1)[keyof typeof MULTISPEQ_COMMANDS_V1];
export type MultispeqCommandV2 = (typeof MULTISPEQ_COMMANDS_V2)[keyof typeof MULTISPEQ_COMMANDS_V2];

/** Command type for the latest firmware version */
export type MultispeqCommand = MultispeqCommandV2;
