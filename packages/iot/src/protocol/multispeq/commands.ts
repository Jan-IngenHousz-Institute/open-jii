/**
 * MultispeQ protocol commands
 * Device-specific command definitions
 */

/** Common MultispeQ commands */
export const MULTISPEQ_COMMANDS = {
  /** Get device information (battery, version, ID) */
  GET_DEVICE_INFO: "1001",

  /** Get device status */
  GET_STATUS: "1002",

  /** Run a measurement */
  RUN_MEASUREMENT: "1003",

  /** Stop current measurement */
  STOP_MEASUREMENT: "1004",

  /** Get measurement data */
  GET_DATA: "1005",

  /** Set device parameter */
  SET_PARAMETER: "1006",

  /** Reset device */
  RESET: "1007",
} as const;

export type MultispeqCommand = (typeof MULTISPEQ_COMMANDS)[keyof typeof MULTISPEQ_COMMANDS];
