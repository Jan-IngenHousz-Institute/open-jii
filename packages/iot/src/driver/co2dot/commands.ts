/**
 * CO2Dot console commands, from the firmware's own `help` catalogue
 * (CO2Dot repository, Firmware/src/app/commands.cpp). LINE mode replies with
 * text; `hello` and INFO reply with JSON.
 */
// prettier-ignore
export const CO2DOT_COMMANDS = {
  // Connection / status
  HELLO:           "hello",           // {"device":"CO2Dot","version":...,"mac":<eFuse MAC>}
  INFO:            "info",            // plain-mode INFO: {"status":"success","data":{...,"device_id":<eFuse MAC>}}
  STATUS:          "status",          // combined spectrometer + BME status
  SPEC_STATUS:     "spec_status",     // spectrometer configuration and status
  BME_STATUS:      "bme_status",      // BME68x configuration and status
  I2C_SCAN:        "i2c_scan",        // I2C bus addresses
  HELP:            "help",            // help, help.<cmd>, help.keys()
  REBOOT:          "reboot",          // restarts the device

  // Measurements
  ENV:             "env",             // BME68x temperature, pressure, humidity, gas
  SPEC:            "spec",            // calibrated spectrometer channels
  SPEC_RAW:        "spec_raw",        // raw spectrometer counts
  SPEC_FLASH:      "spec_flash",      // spec_flash,<mA>,<repeat>: flash the LED, then read
  SPEC_FLASH_WAVE: "spec_flash_wave", // spec_flash_wave,<mA>,<nm>: flash at a wavelength, then read

  // Configuration
  SET_LED:         "set_led",         // set_led,<mA>
  SPEC_SET_ATIME:  "spec_set_atime",  // spec_set_atime,<n>
  SPEC_SET_ASTEP:  "spec_set_astep",  // spec_set_astep,<n>
  SPEC_SET_GAIN:   "spec_set_gain",   // spec_set_gain,<n>
} as const;
