/**
 * MultispeQ protocol commands
 * Device-specific command definitions
 *
 * The MultispeQ device accepts two types of commands:
 * 1. Simple string commands (e.g. "battery", "sleep")
 * 2. Protocol JSON arrays (Record<string, unknown>[]) for measurements
 */

/** Simple MultispeQ string commands */
export const MULTISPEQ_COMMANDS = {
  /** Query battery level — returns "battery:<number>" */
  BATTERY: "battery",

  /** Put the device to sleep (power off) */
  SLEEP: "sleep",

  /** Confirmation / handshake command */
  HELLO: "hello",
} as const;

export type MultispeqCommand = (typeof MULTISPEQ_COMMANDS)[keyof typeof MULTISPEQ_COMMANDS];
