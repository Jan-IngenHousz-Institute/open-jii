/**
 * Known MultispeQ console commands surfaced as autocomplete suggestions in the
 * workbook command cell. These are the parameter-free diagnostic / status /
 * calibration commands; parameterised commands (e.g. `set_colorcal1+…`) are
 * intentionally excluded here and handled by dynamic command payload binding
 * (OJD-1603).
 *
 * Mirrors the command strings in
 * `@repo/iot` → `src/driver/multispeq/commands.ts` (MULTISPEQ_COMMANDS_V2).
 * `@repo/api` is consumed by the backend, so it must not depend on `@repo/iot`;
 * this curated list is kept in sync by hand.
 *
 * These are suggestions only — the command cell stays free-form, so any string
 * the firmware understands can still be sent.
 */
export interface DeviceCommandOption {
  value: string;
  label: string;
  group: string;
  description?: string;
}

export const KNOWN_DEVICE_COMMANDS = [
  // Connection / Status
  {
    value: "hello",
    label: "Hello",
    group: "Connection",
    description: 'Responds "Instrument Ready"',
  },
  {
    value: "battery",
    label: "Battery",
    group: "Connection",
    description: "Charge level in percent",
  },
  { value: "usb", label: "USB", group: "Connection", description: "Check if connected via USB" },
  {
    value: "sleep",
    label: "Sleep",
    group: "Connection",
    description: "Sleep (hold button 5s to wake)",
  },
  { value: "reset", label: "Reset", group: "Connection", description: "Reboot the instrument" },
  { value: "reboot", label: "Reboot", group: "Connection", description: "Reboot the instrument" },

  // Device info
  {
    value: "device_info",
    label: "Device info",
    group: "Device info",
    description: "Name, version, id, battery, firmware, config",
  },
  {
    value: "compiled",
    label: "Compiled",
    group: "Device info",
    description: "Firmware compile date/time",
  },
  { value: "memory", label: "Memory", group: "Device info" },

  // Sensors
  {
    value: "temp",
    label: "Temperature",
    group: "Sensors",
    description: "Temperature + relative humidity (BME280)",
  },

  // Calibration / EEPROM
  {
    value: "print_all",
    label: "Print all",
    group: "Calibration",
    description: "All EEPROM values",
  },
  {
    value: "print_memory",
    label: "Print memory",
    group: "Calibration",
    description: "Calibrations as JSON with checksum",
  },
  { value: "print_date", label: "Print date", group: "Calibration", description: "RTC date" },
  { value: "print_magnetometer", label: "Print magnetometer", group: "Calibration" },
  { value: "print_magnetometer_bias", label: "Print magnetometer bias", group: "Calibration" },

  // Flow (v2)
  { value: "get_flow", label: "Get flow", group: "Flow" },
  { value: "flow_off", label: "Flow off", group: "Flow" },

  // LED / Light
  { value: "on_5v", label: "On 5V", group: "Light", description: "Turn on 5V for 30s" },
  { value: "indicate_off", label: "Indicator off", group: "Light" },
] as const satisfies readonly DeviceCommandOption[];
