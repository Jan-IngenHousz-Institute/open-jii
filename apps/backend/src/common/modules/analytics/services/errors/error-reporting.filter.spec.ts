import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsConfigService } from "../config/config.service";
import { ErrorReporterService } from "./error-reporter.service";
import { ErrorReportingFilter } from "./error-reporting.filter";

class RecordingReporter extends ErrorReporterService {
  readonly reports: { error: unknown; properties: Record<string, unknown>; userId?: string }[] = [];

  override report(error: unknown, properties: Record<string, unknown> = {}, userId?: string): void {
    this.reports.push({ error, properties, userId });
  }
}

const reporter = new RecordingReporter(
  new AnalyticsConfigService(
    new ConfigService({
      analytics: { posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com" },
    }),
  ),
);
const filter = new ErrorReportingFilter(new HttpAdapterHost(), reporter);

// Nest's own host, typed "http" by default, with the request as its first argument.
function httpHost(request: Record<string, unknown>): ExecutionContextHost {
  return new ExecutionContextHost([request, {}, vi.fn()]);
}

let respond: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reporter.reports.length = 0;
  respond = vi.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => undefined);
});

describe("ErrorReportingFilter", () => {
  it("reports an unexpected error under its route pattern and user, then responds as Nest would", () => {
    const error = new TypeError("undefined is not a function");
    const host = httpHost({
      user: { id: "user-1" },
      id: "req-1",
      method: "POST",
      path: "/api/v1/experiments/42/data/uploads",
      route: { path: "/api/v1/experiments/:id/data/uploads" },
    });

    filter.catch(error, host);

    expect(reporter.reports).toEqual([
      {
        error,
        properties: {
          http_method: "POST",
          route: "/api/v1/experiments/:id/data/uploads",
          status: 500,
          request_id: "req-1",
        },
        userId: "user-1",
      },
    ]);
    expect(respond).toHaveBeenCalledWith(error, host);
  });

  it("falls back to the path when no route matched", () => {
    filter.catch(new HttpException("bad gateway", 502), httpHost({ method: "GET", path: "/x" }));

    expect(reporter.reports[0]?.properties).toEqual({
      http_method: "GET",
      route: "/x",
      status: 502,
      request_id: undefined,
    });
  });

  it("does not report a client error, but still responds", () => {
    const missing = new HttpException("missing", 404);

    filter.catch(missing, httpHost({ method: "GET", path: "/x" }));

    expect(reporter.reports).toEqual([]);
    expect(respond).toHaveBeenCalled();
  });
});
