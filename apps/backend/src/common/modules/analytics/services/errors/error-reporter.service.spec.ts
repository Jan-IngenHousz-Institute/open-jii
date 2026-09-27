import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ORPCError } from "@orpc/nest";
import { describe, expect, it, vi } from "vitest";

import type { PostHogServerClient } from "@repo/analytics/server";

import { AnalyticsConfigService } from "../config/config.service";
import { ErrorReporterService } from "./error-reporter.service";

function configFor(environment?: string): AnalyticsConfigService {
  return new AnalyticsConfigService(
    new ConfigService({
      analytics: { posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com", environment },
    }),
  );
}

const captureException = vi.fn();
const contexts: unknown[] = [];

// A plain function, since a mock cannot stand in for a generic method.
function withContext<T>(data: object, fn: () => T, options?: object): T {
  contexts.push({ data, options });
  return fn();
}

class ReporterUnderTest extends ErrorReporterService {
  connected = true;

  protected override getPostHogClient(): PostHogServerClient | null {
    return this.connected
      ? {
          captureException,
          captureExceptionImmediate: vi.fn(),
          withContext,
          getContext: () => undefined,
          isFeatureEnabled: vi.fn(),
          shutdown: vi.fn(),
        }
      : null;
  }
}

describe("ErrorReporterService", () => {
  it("tags a report with its environment and service, and counts it once when nobody is signed in", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));
    const error = new Error("boom");

    reporter.report(error, { route: "/api/v1/experiments/{id}" });

    expect(captureException).toHaveBeenCalledWith(error, "backend-server", {
      route: "/api/v1/experiments/{id}",
      environment: "dev",
      service: "backend",
      $process_person_profile: false,
    });
  });

  it("counts a report against the user it names", () => {
    new ReporterUnderTest(configFor("dev")).report(new Error("boom"), {}, "user-1");

    expect(captureException).toHaveBeenLastCalledWith(
      expect.any(Error),
      "user-1",
      expect.objectContaining({ $process_person_profile: false }),
    );
  });

  it("runs a request's work as its user and request id, so reports made inside carry both", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));

    expect(reporter.withRequest({ user: { id: "user-1" }, id: "req-1" }, () => "done")).toBe(
      "done",
    );
    expect(contexts.at(-1)).toEqual({
      data: { distinctId: "user-1", properties: { request_id: "req-1" } },
      options: { fresh: true },
    });
  });

  it("runs an anonymous request's work under its request id alone", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));

    expect(reporter.withRequest({ id: "req-2" }, () => "anonymous")).toBe("anonymous");
    expect(contexts.at(-1)).toEqual({
      data: { distinctId: undefined, properties: { request_id: "req-2" } },
      options: { fresh: true },
    });
  });

  it("runs work without a context when PostHog is not configured", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));
    reporter.connected = false;
    contexts.length = 0;

    expect(reporter.withRequest({ id: "req-3" }, () => "offline")).toBe("offline");
    expect(contexts).toEqual([]);
  });

  it("reads the request id pino gave the request", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));

    expect(reporter.requestIdOf({ id: "Root=1-abc" })).toBe("Root=1-abc");
    expect(reporter.requestIdOf({ id: 7 })).toBe("7");
    expect(reporter.requestIdOf({})).toBeUndefined();
  });

  it("reads the signed-in user from the request the auth guard filled", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));

    expect(reporter.userIdOf({ user: { id: "user-1" } })).toBe("user-1");
    expect(reporter.userIdOf({ user: null })).toBeUndefined();
    expect(reporter.userIdOf({})).toBeUndefined();
  });

  it("names a run without ENVIRONMENT_PREFIX local", () => {
    new ReporterUnderTest(configFor()).report(new Error("boom"));

    expect(captureException).toHaveBeenLastCalledWith(
      expect.any(Error),
      "backend-server",
      expect.objectContaining({ environment: "local" }),
    );
  });

  it("does nothing when PostHog is not configured", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));
    reporter.connected = false;
    captureException.mockClear();

    reporter.report(new Error("boom"));

    expect(captureException).not.toHaveBeenCalled();
  });

  it("never throws, so a PostHog failure cannot change a response", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    captureException.mockImplementationOnce(() => {
      throw new Error("posthog down");
    });

    expect(() => new ReporterUnderTest(configFor("dev")).report(new Error("boom"))).not.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it("counts only 5xx and unexpected errors as server errors", () => {
    const reporter = new ReporterUnderTest(configFor("dev"));

    expect(reporter.isServerError(new HttpException("missing", 404))).toBe(false);
    expect(reporter.isServerError(new HttpException("broken", 502))).toBe(true);
    expect(reporter.isServerError(new ORPCError("NOT_FOUND", { status: 404 }))).toBe(false);
    expect(reporter.isServerError(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(true);
    expect(reporter.isServerError(new TypeError("undefined is not a function"))).toBe(true);
  });
});
