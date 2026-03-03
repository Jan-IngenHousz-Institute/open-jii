/**
 * Generic device commands
 * Simple command set for any custom device (Arduino, RPi, sensors, etc.)
 *
 * Commands are split into two tiers:
 *   Required — every device must implement these (INFO + RUN).
 *   Optional — device may advertise support via the `capabilities` field in its INFO response.
 */

// prettier-ignore
/** Minimum command set every generic device must support */
export const GENERIC_REQUIRED_COMMANDS = {
  INFO: "INFO", // device name, type, version, capabilities
  RUN:  "RUN",  // execute measurement / action
} as const;

// prettier-ignore
/** Commands a device may optionally support (advertised via capabilities) */
export const GENERIC_OPTIONAL_COMMANDS = {
  DISCOVER:   "DISCOVER",   // list commands supported by device
  SET_CONFIG: "SET_CONFIG", // push configuration / protocol JSON
  GET_CONFIG: "GET_CONFIG", // read current configuration
  STOP:       "STOP",       // abort current measurement / action
  GET_DATA:   "GET_DATA",   // retrieve measurement results
  RESET:      "RESET",      // clear / reset device state
  DISCONNECT: "DISCONNECT", // graceful disconnect
  PING:       "PING",       // keep-alive / health check
} as const;

/** All generic commands — merged superset of required + optional */
// prettier-ignore
export const GENERIC_COMMANDS = {
  ...GENERIC_REQUIRED_COMMANDS,
  ...GENERIC_OPTIONAL_COMMANDS,
} as const;

export type GenericRequiredCommand =
  (typeof GENERIC_REQUIRED_COMMANDS)[keyof typeof GENERIC_REQUIRED_COMMANDS];
export type GenericOptionalCommand =
  (typeof GENERIC_OPTIONAL_COMMANDS)[keyof typeof GENERIC_OPTIONAL_COMMANDS];
export type GenericCommand = (typeof GENERIC_COMMANDS)[keyof typeof GENERIC_COMMANDS];

export interface GenericCommandWithParams {
  command: GenericCommand;
  params?: Record<string, unknown>;
  id?: string;
}

export interface CustomCommandWithParams {
  command: string;
  params?: Record<string, unknown>;
  id?: string;
}
