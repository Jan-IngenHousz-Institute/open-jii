import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ORPCError } from "@orpc/nest";
import { createProcedureClient, os } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AnalyticsConfigService } from "../config/config.service";
import { ErrorReporterService } from "./error-reporter.service";
import { OrpcErrorInterceptor } from "./orpc-error.interceptor";

class RecordingReporter extends ErrorReporterService {
  readonly reports: { error: unknown; properties: Record<string, unknown> }[] = [];

  override report(error: unknown, properties: Record<string, unknown> = {}): void {
    this.reports.push({ error, properties });
  }
}

const reporter = new RecordingReporter(
  new AnalyticsConfigService(
    new ConfigService({
      analytics: { posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com" },
    }),
  ),
);
const interceptor = new OrpcErrorInterceptor(reporter);
const route = os.route({ method: "GET", path: "/api/v1/experiments/{id}" });

function clientFor(handler: () => unknown, output: z.ZodTypeAny = z.unknown()) {
  return createProcedureClient(route.output(output).handler(handler), {
    interceptors: [interceptor.intercept],
  });
}

const logged: unknown[] = [];

beforeEach(() => {
  reporter.reports.length = 0;
  logged.length = 0;
  vi.spyOn(Logger.prototype, "error").mockImplementation((message: unknown) => {
    logged.push(message);
  });
});

describe("OrpcErrorInterceptor", () => {
  it("passes the handler's result through untouched", async () => {
    await expect(clientFor(() => ["row"])(undefined)).resolves.toEqual(["row"]);

    expect(reporter.reports).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("logs and reports an output-validation failure under its route, then rethrows", async () => {
    const call = clientFor(() => ({ name: 1 }), z.object({ name: z.string() }))(undefined);

    await expect(call).rejects.toThrow("Output validation failed");

    expect(logged[0]).toMatchObject({
      msg: "Output validation failed",
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(logged[0]).toHaveProperty("issues");
    expect(reporter.reports[0]?.properties).toHaveProperty("issues");
    expect(reporter.reports[0]?.properties).toMatchObject({
      http_method: "GET",
      route: "/api/v1/experiments/{id}",
      error_code: "INTERNAL_SERVER_ERROR",
      status: 500,
      $exception_fingerprint: "orpc:INTERNAL_SERVER_ERROR:GET /api/v1/experiments/{id}",
    });
  });

  it("fingerprints an AppError by its code, since they all throw from one line", async () => {
    const failure = new ORPCError("INTERNAL_SERVER_ERROR", {
      status: 500,
      message: "Failed to execute SQL query",
      data: { code: "DATABRICKS_SQL_FAILED" },
    });

    await expect(
      clientFor(() => {
        throw failure;
      })(undefined),
    ).rejects.toBe(failure);

    expect(reporter.reports[0]?.properties).toMatchObject({
      error_code: "DATABRICKS_SQL_FAILED",
      $exception_fingerprint: "orpc:DATABRICKS_SQL_FAILED:GET /api/v1/experiments/{id}",
    });
  });

  it("reports where throwOrpcError logged from, but keeps its details in the log", async () => {
    const failure = new ORPCError("INTERNAL_SERVER_ERROR", {
      status: 500,
      message: "Failed to execute SQL query",
      data: { code: "DATABRICKS_SQL_FAILED" },
      cause: {
        msg: "Failed to execute SQL query",
        errorCode: "DATABRICKS_SQL_FAILED",
        operation: "getExperimentData",
        context: "ExperimentDataController",
        details: { statementId: "01ef" },
      },
    });

    await expect(
      clientFor(() => {
        throw failure;
      })(undefined),
    ).rejects.toBe(failure);

    expect(reporter.reports[0]?.properties).toMatchObject({
      operation: "getExperimentData",
      context: "ExperimentDataController",
    });
    expect(reporter.reports[0]?.properties).not.toHaveProperty("details");
  });

  it("leaves 4xx errors alone, since the caller made the mistake", async () => {
    const missing = new ORPCError("NOT_FOUND", { status: 404, message: "missing" });

    await expect(
      clientFor(() => {
        throw missing;
      })(undefined),
    ).rejects.toBe(missing);

    expect(reporter.reports).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("leaves non-oRPC errors to the Nest filter the rethrow plugin hands them to", async () => {
    await expect(
      clientFor(() => {
        throw new TypeError("unrelated");
      })(undefined),
    ).rejects.toThrow();

    expect(reporter.reports).toEqual([]);
  });
});
