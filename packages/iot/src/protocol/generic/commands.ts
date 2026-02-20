/**
 * Generic device protocol commands
 * Simple command set for any custom device (Arduino, RPi, sensors, etc.)
 */

/** Generic device commands */
export const GENERIC_COMMANDS = {
  /** Get device information (name, type, version, capabilities) */
  INFO: "INFO",

  /** Discover available commands supported by device */
  DISCOVER: "DISCOVER",

  /** Set configuration/protocol JSON on device */
  SET_CONFIG: "SET_CONFIG",

  /** Get current configuration from device */
  GET_CONFIG: "GET_CONFIG",

  /** Execute measurement/action based on loaded config */
  RUN: "RUN",

  /** Stop current measurement/action */
  STOP: "STOP",

  /** Get measurement data/results */
  GET_DATA: "GET_DATA",

  /** Clear/reset device state */
  RESET: "RESET",

  /** Disconnect from device (cleanup) */
  DISCONNECT: "DISCONNECT",

  /** Ping device (keep-alive/health check) */
  PING: "PING",
} as const;

export type GenericCommand = (typeof GENERIC_COMMANDS)[keyof typeof GENERIC_COMMANDS];

/** Command with parameters */
export interface GenericCommandWithParams {
  command: GenericCommand;
  params?: Record<string, unknown>;
  id?: string;
}

/** For custom commands not in the standard set */
export interface CustomCommandWithParams {
  command: string;
  params?: Record<string, unknown>;
  id?: string;
}
