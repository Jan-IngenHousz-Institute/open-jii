/**
 * Pluggable logger interface for the IoT package.
 *
 * Consumers inject a logger via constructor when creating drivers or transports.
 * If omitted, a default console-backed logger is used.
 *
 * @example
 * ```ts
 * import { logger } from "@repo/analytics";
 * import { MultispeqDriver } from "@repo/iot";
 *
 * const driver = new MultispeqDriver(logger);
 * ```
 */

/** Minimal structured-logger contract (subset of pino / console / winston). */
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

/** Default console-backed logger used when no logger is injected. */
export const defaultLogger: Logger = {
  debug(msg, ...args) {
    console.debug(msg, ...args);
  },
  info(msg, ...args) {
    console.info(msg, ...args);
  },
  warn(msg, ...args) {
    console.warn(msg, ...args);
  },
  error(msg, ...args) {
    console.error(msg, ...args);
  },
};
