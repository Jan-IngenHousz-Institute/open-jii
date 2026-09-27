import type { Instrumentation } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestError } from "./instrumentation";
import { reportServerError } from "./lib/posthog-server";

vi.mock("./lib/posthog-server", () => ({ reportServerError: vi.fn() }));

const request = { path: "/en/platform/experiments/42", method: "GET", headers: {} };
const context: Parameters<Instrumentation.onRequestError>[2] = {
  routerKind: "App Router",
  routePath: "/[locale]/platform/experiments/[id]",
  routeType: "render",
  renderSource: "server-rendering",
  revalidateReason: undefined,
};

beforeEach(() => {
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.mocked(reportServerError).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("onRequestError", () => {
  it("reports a server error under its route pattern", async () => {
    const error = Object.assign(new Error("boom"), { digest: "1234567" });

    await onRequestError(error, request, context);

    expect(reportServerError).toHaveBeenCalledWith(error, {
      http_method: "GET",
      route: "/[locale]/platform/experiments/[id]",
      route_type: "render",
      router: "App Router",
      digest: "1234567",
    });
  });

  it("leaves notFound() and redirect() alone, since they are answers rather than failures", async () => {
    await onRequestError(
      Object.assign(new Error("x"), { digest: "NEXT_NOT_FOUND" }),
      request,
      context,
    );
    await onRequestError(
      Object.assign(new Error("x"), { digest: "NEXT_REDIRECT;replace;/en;307;" }),
      request,
      context,
    );
    await onRequestError(
      Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }),
      request,
      context,
    );

    expect(reportServerError).not.toHaveBeenCalled();
  });

  it("stays out of the edge runtime, where posthog-node cannot run", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await onRequestError(new Error("boom"), request, context);

    expect(reportServerError).not.toHaveBeenCalled();
  });
});
