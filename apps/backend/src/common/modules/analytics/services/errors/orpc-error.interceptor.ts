import { Injectable, Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";
import type { ORPCModuleConfig } from "@orpc/nest";

import { ErrorReporterService } from "./error-reporter.service";

type ClientInterceptor = NonNullable<ORPCModuleConfig["interceptors"]>[number];

/**
 * Logs and reports 5xx ORPCErrors. oRPC serializes them straight to the response (the rethrow
 * plugin only forwards non-oRPC errors to Nest), so without this, server errors raised inside the
 * pipeline, most notably output-validation failures, reach neither the logs nor PostHog.
 */
@Injectable()
export class OrpcErrorInterceptor {
  private readonly logger = new Logger("ORPC");

  constructor(private readonly reporter: ErrorReporterService) {}

  // A property, so oRPC can call it detached from the instance.
  readonly intercept: ClientInterceptor = async (options) => {
    try {
      const result: unknown = await options.next();
      return result;
    } catch (error) {
      if (error instanceof ORPCError && error.status >= 500) {
        // The contract's route pattern, not the requested path, so one bug is one issue.
        const { method, path } = options.procedure["~orpc"].route;
        const issues = this.issuesOf(error.cause);
        const code = this.appErrorCodeOf(error.data) ?? String(error.code);

        this.logger.error({
          msg: error.message,
          code: String(error.code),
          ...(issues === undefined ? {} : { issues }),
        });
        this.reporter.report(error, {
          http_method: method,
          route: path,
          orpc_code: String(error.code),
          error_code: code,
          status: error.status,
          ...(issues === undefined ? {} : { issues: JSON.stringify(issues).slice(0, 2000) }),
          ...this.loggedFieldsOf(error.cause),
          $exception_fingerprint: `orpc:${code}:${method ?? "?"} ${path ?? "?"}`,
        });
      }
      throw error;
    }
  };

  private issuesOf(cause: unknown): unknown {
    return typeof cause === "object" && cause !== null && "issues" in cause
      ? cause.issues
      : undefined;
  }

  // Where `throwOrpcError` logged from, so the report leads to the log line. Its details stay in the
  // log, since they can carry what a user sent.
  private loggedFieldsOf(cause: unknown): Record<string, unknown> {
    if (typeof cause !== "object" || cause === null || !("errorCode" in cause)) {
      return {};
    }

    return {
      ...("operation" in cause ? { operation: cause.operation } : {}),
      ...("context" in cause ? { context: cause.context } : {}),
    };
  }

  // `throwOrpcError` puts the AppError's code in the error's data.
  private appErrorCodeOf(data: unknown): string | undefined {
    return typeof data === "object" &&
      data !== null &&
      "code" in data &&
      typeof data.code === "string"
      ? data.code
      : undefined;
  }
}
