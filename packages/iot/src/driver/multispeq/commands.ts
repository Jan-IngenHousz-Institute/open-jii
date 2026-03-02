/**
 * MultispeQ console commands
 *
 * Sourced from PhotosynQ documentation.
 *
 * The device also accepts entity-protocol JSON (Record<string, unknown>[])
 * for measurements — those are sent directly via execute() and not listed here.
 */

// ─── Console control sequences ───────────────────────────────────────────────

/** Control sequences for the MultispeQ console */
export const MULTISPEQ_CONSOLE = {
  /** Silent mode — suppress interactive queries */
  SILENT: "s+",
  /** Verbose mode — enable interactive queries */
  VERBOSE: "v+",
  /** Cancel a continuous-output command (e.g. hall, 1053) */
  CANCEL: "-1+",
} as const;

// ─── Commands shared across all firmware versions ────────────────────────────

const MULTISPEQ_COMMANDS_BASE = {
  // ── Connection / Status ──
  /** Check connection — responds "Instrument Ready" (alias: 1000) */
  HELLO: "hello",
  /** Battery charge in percent */
  BATTERY: "battery",
  /** Put device to sleep — hold button 5 s to wake */
  SLEEP: "sleep",
  /** Reboot the instrument (alias: 1027) */
  RESET: "reset",
  /** Reboot the instrument */
  REBOOT: "reboot",

  // ── Device Info ──
  /** Full device info: name, version, id, battery, firmware, config (alias: 1007) */
  DEVICE_INFO: "device_info",
  /** Set the device name (alias: 1008) */
  SET_DEVICE_INFO: "set_device_info",
  /** Firmware compile date/time */
  COMPILED: "compiled",
  /** Memory usage */
  MEMORY: "memory",

  // ── Sensors ──
  /** Temperature + relative humidity (BME280) */
  TEMP: "temp",
  /** Continuous hall sensor readings (cancel with -1+) */
  HALL: "hall",
  /** Continuous IMU feed: roll, pitch, compass, direction, tilt (cancel with -1+) */
  IMU_FEED: "1053",

  // ── Calibration / EEPROM ──
  /** Print all EEPROM values */
  PRINT_ALL: "print_all",
  /** Calibration values as JSON with checksum (alias: print_calibrations) */
  PRINT_MEMORY: "print_memory",
  /** Date from RTC */
  PRINT_DATE: "print_date",
  /** Magnetometer readings */
  PRINT_MAGNETOMETER: "print_magnetometer",
  /** Magnetometer bias */
  PRINT_MAGNETOMETER_BIAS: "print_magnetometer_bias",
  /** Set accelerometer calibration */
  SET_ACCELEROMETER: "set_accelerometer",
  /** Set accelerometer bias */
  SET_ACCELEROMETER_BIAS: "set_accelerometer_bias",
  /** Color calibration channel 1 */
  SET_COLORCAL1: "set_colorcal1",
  /** Color calibration channel 2 */
  SET_COLORCAL2: "set_colorcal2",
  /** Color calibration channel 3 */
  SET_COLORCAL3: "set_colorcal3",
  /** Color calibration blanks */
  SET_COLORCAL_BLANKS: "set_colorcal_blanks",
  /** Set DAC addresses (1,2,3) */
  SET_DAC: "set_dac",
  /** Set RTC date: set_date+hours+min+sec+day+month+year */
  SET_DATE: "set_date",
  /** Detector 1 offset */
  SET_DETECTOR1_OFFSET: "set_detector1_offset",
  /** Detector 2 offset */
  SET_DETECTOR2_OFFSET: "set_detector2_offset",
  /** Detector 3 offset */
  SET_DETECTOR3_OFFSET: "set_detector3_offset",
  /** Detector 4 offset */
  SET_DETECTOR4_OFFSET: "set_detector4_offset",
  /** LED PAR calibration */
  SET_LED_PAR: "set_led_par",
  /** Magnetometer calibration */
  SET_MAGNETOMETER: "set_magnetometer",
  /** Magnetometer bias */
  SET_MAGNETOMETER_BIAS: "set_magnetometer_bias",
  /** PAR calibration */
  SET_PAR: "set_par",
  /** Serial number */
  SET_SERIAL: "set_serial",
  /** Thickness calibration */
  SET_THICKNESS: "set_thickness",
  /** Quick thickness calibration */
  SET_THICKNESS_QUICK: "set_thickness_quick",
  /** Save user-defined EEPROM value: set_user_defined+<location>+<value> */
  SET_USER_DEFINED: "set_user_defined",

  // ── LED / Light ──
  /** Turn on 5 V light: light<number> */
  LIGHT: "light",
  /** Turn on 5 V for 30 s */
  ON_5V: "on_5v",

  // ── Hardware / I2C ──
  /** Scan for I²C devices */
  SCAN_I2C: "scan_i2c",
  /** Access write-once flash */
  READONCE: "readonce",
  /** TCS length */
  TCS_LENGTH: "tcs_length",

  // ── Testing / Debug ──
  /** Enter test mode */
  TESTMODE: "testmode",
  /** Single LED pulse noise analysis (testmode only) */
  SINGLE_PULSE: "single_pulse",
  /** Pulse-to-pulse linearity / stdev test */
  P2P: "p2p",
  /** Pulse */
  PULSE: "pulse",
  /** PAR LED test */
  PAR_LED: "par_led",
  /** Expression evaluator */
  EXPR: "expr",
  /** Start watchdog */
  START_WATCHDOG: "start_watchdog",
  /** Stop watchdog */
  STOP_WATCHDOG: "stop_watchdog",

  // ── Bluetooth ──
  /** Set bluetooth name and baud rate */
  CONFIGURE_BLUETOOTH: "configure_bluetooth",

  // ── Firmware ──
  /** Start OTA firmware update (alias: 1078) */
  UPGRADE: "upgrade",
} as const;

// ─── v1.17-only commands (MultispeQ 1) ───────────────────────────────────────

const MULTISPEQ_V1_ONLY = {
  /** IMU variant */
  IMU_1054: "1054",
  /** Pulse linearity test (replaced by p2p in v2) */
  LINEARITY_4048: "4048",
  /** ADC channel 1 reading */
  ADC1: "adc1",
  /** All ADC values */
  ADC_CHECK: "adc_check",
  /** Continuous all-sensor output (cancel with -1+) */
  ALL_SENSORS: "all_sensors",
  /** Any light */
  ANY_LIGHT: "any_light",
  /** Compass calibration */
  CALIBRATE_COMPASS: "calibrate_compass",
  /** LED calibration */
  CALIBRATE_LEDS: "calibrate_leds",
  /** Manual LED calibration */
  CALIBRATE_LEDS_MANUAL: "calibrate_leds_manual",
  /** Constant light source (cancel with -1+) */
  CONSTANT_LIGHT: "constant_light",
  /** Cut-through mode */
  CUT_THROUGH: "cut_through",
  /** Cycle 5 V */
  CYCLE5V: "cycle5v",
  /** Set all DAC outputs to 50 % */
  DAC50: "dac50",
  /** Feed watchdog */
  FEED_WATCHDOG: "feed_watchdog",
  /** Sensair S8 CO₂ reading (Serial Port 3) */
  GET_CO2: "get_co2",
} as const;

// ─── v2-only commands (MultispeQ 1 + 2) ─────────────────────────────────────

const MULTISPEQ_V2_ONLY = {
  // ── Connection / Status ──
  /** Check if connected via USB */
  USB: "usb",

  // ── Flow ──
  /** Set air flow (input: number) */
  SET_FLOW: "set_flow",
  /** Get flow reading */
  GET_FLOW: "get_flow",
  /** Set air flow to zero */
  FLOW_OFF: "flow_off",
  /** Flow velocity */
  FLOW_V: "flow_v",
  /** Flow calibration set point (alias: fcsp) */
  FLOW_CALIBRATION_SET_POINT: "flow_calibration_set_point",
  /** Flow calibration setting (alias: fcv) */
  FLOW_CALIBRATION_SETTING: "flow_calibration_setting",
  /** Flow calibration value (alias: fcv) */
  FLOW_CALIBRATION_VALUE: "flow_calibration_value",
  /** Reset flow calibration to factory settings */
  RESET_FLOW_CALIBRATION: "reset_flow_calibration",
  /** Reset flow zero point */
  RESET_FLOW_ZERO_POINT: "reset_flow_zero_point",
  /** Default flow rate (input: number) */
  SET_DEFAULT_FLOW_RATE: "set_default_flow_rate",

  // ── LED / Indicator ──
  /** Set indicator RGB LED: indicate+<R>+<G>+<B> (0–255) */
  INDICATE: "indicate",
  /** Turn off indicator LED */
  INDICATE_OFF: "indicate_off",

  // ── Hardware ──
  /** Digital write to address — dangerous (input: number, value: 0|1) */
  DIGITAL_WRITE: "digital_write",

  // ── Clamp positions (added v2.0038) ──
  /** Set close position of leaf clamp */
  SET_CP: "set_cp",
  /** Set open position of leaf clamp */
  SET_OP: "set_op",
  /** Set open/closed positions */
  SET_OPEN_CLOSED_POSITIONS: "set_open_closed_positions",

  // ── Power / Timing ──
  /** Energy save time (input: number) */
  SET_ENERGY_SAVE_TIME: "set_energy_save_time",
  /** Auto-shutdown time in seconds */
  SET_SHUTDOWN_TIME: "set_shutdown_time",
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
