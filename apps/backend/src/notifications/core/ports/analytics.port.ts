/**
 * Injection token for the Analytics port
 */
export const ANALYTICS_PORT = Symbol("ANALYTICS_PORT");

/**
 * Port for error tracking in the notifications domain
 */
export interface AnalyticsPort {
  /**
   * Report an error that points at a bug to error tracking, for work outside a request
   * @param properties - What identifies the failure, such as the operation and error code
   */
  reportError(error: unknown, properties: Record<string, unknown>): void;
}
