import { HttpException, Injectable } from "@nestjs/common";
import { ORPCError } from "@orpc/nest";

import { getPostHogServerClient, reportException } from "@repo/analytics/server";

import { AnalyticsConfigService } from "../config/config.service";

/**
 * Sends server errors to PostHog error tracking, where they are grouped into issues that alert and
 * can be picked up.
 */
@Injectable()
export class ErrorReporterService {
  constructor(private readonly configService: AnalyticsConfigService) {}

  /* v8 ignore next 3 */
  protected getPostHogClient(): ReturnType<typeof getPostHogServerClient> {
    return getPostHogServerClient();
  }

  /** A server error points at a bug; a 4xx is the caller's mistake and is left out. */
  isServerError(error: unknown): boolean {
    if (error instanceof HttpException) {
      return error.getStatus() >= 500;
    }
    if (error instanceof ORPCError) {
      return error.status >= 500;
    }
    return true;
  }

  /**
   * `$exception_fingerprint` in the properties groups errors thrown from one shared line (such as
   * `throwOrpcError`) by what went wrong rather than by where they were thrown. Without a user id,
   * the one `withRequest` set for the running request applies.
   */
  report(error: unknown, properties: Record<string, unknown> = {}, userId?: string): void {
    void reportException(this.getPostHogClient(), error, {
      service: "backend",
      environment: this.configService.environment,
      distinctId: userId,
      properties,
    });
  }

  /**
   * Runs `fn` as this request, so every error reported while it runs, across awaits, carries its
   * user and the request id its log lines carry.
   */
  withRequest<T>(request: object, fn: () => T): T {
    const client = this.getPostHogClient();
    if (client === null) {
      return fn();
    }

    const requestId = this.requestIdOf(request);
    return client.withContext(
      {
        distinctId: this.userIdOf(request),
        properties: requestId === undefined ? {} : { request_id: requestId },
      },
      fn,
      { fresh: true },
    );
  }

  /** The id pino gave the request, which every log line of it carries. */
  requestIdOf(request: object): string | undefined {
    const id: unknown = "id" in request ? request.id : undefined;
    return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
  }

  /** The signed-in user's id, which the Better Auth guard puts on the request. */
  userIdOf(request: object): string | undefined {
    const user: unknown = "user" in request ? request.user : undefined;
    return typeof user === "object" && user !== null && "id" in user && typeof user.id === "string"
      ? user.id
      : undefined;
  }
}
