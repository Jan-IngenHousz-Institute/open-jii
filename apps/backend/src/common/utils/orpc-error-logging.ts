import type { Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";

/**
 * oRPC client interceptor that logs 5xx ORPCErrors. ORPCErrors are serialized
 * straight to the response by oRPC (the rethrow plugin only forwards non-oRPC
 * errors to Nest), so without this, server errors raised inside the pipeline —
 * most notably output-validation failures — never reach the logs. nestjs-pino
 * attaches the request (method + url) to each line.
 */
export function createOrpcErrorLoggingInterceptor(logger: Logger) {
  return async (options: { next: (this: void) => Promise<unknown> }): Promise<unknown> => {
    try {
      return await options.next();
    } catch (error) {
      if (error instanceof ORPCError && error.status >= 500) {
        const cause: unknown = error.cause;
        let issues: unknown;
        if (typeof cause === "object" && cause !== null && "issues" in cause) {
          issues = (cause as Record<string, unknown>).issues;
        }
        logger.error({
          msg: error.message,
          code: String(error.code),
          ...(issues !== undefined ? { issues } : {}),
        });
      }
      throw error;
    }
  };
}
