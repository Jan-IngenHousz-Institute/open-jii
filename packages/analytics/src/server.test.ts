import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostHogServerClient } from "./server";
import { reportException } from "./server";

const client = {
  isFeatureEnabled: vi.fn(),
  captureException: vi.fn(),
  captureExceptionImmediate: vi.fn(),
  withContext: vi.fn(),
  getContext: vi.fn<PostHogServerClient["getContext"]>(),
  shutdown: vi.fn(),
} satisfies PostHogServerClient;

describe("reportException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tags the error with its service and environment, and never makes a person", async () => {
    const error = new Error("boom");

    await reportException(client, error, {
      service: "backend",
      environment: "dev",
      distinctId: "user-1",
      properties: { route: "/api/v1/experiments/{id}" },
    });

    expect(client.captureException).toHaveBeenCalledWith(error, "user-1", {
      route: "/api/v1/experiments/{id}",
      environment: "dev",
      service: "backend",
      $process_person_profile: false,
    });
    expect(client.captureExceptionImmediate).not.toHaveBeenCalled();
  });

  it("sends before resolving when asked to, for code frozen once it responds", async () => {
    await reportException(client, new Error("boom"), {
      service: "web",
      environment: "prod",
      immediate: true,
    });

    expect(client.captureExceptionImmediate).toHaveBeenCalledWith(
      expect.any(Error),
      "web-server",
      expect.objectContaining({ service: "web", environment: "prod" }),
    );
    expect(client.captureException).not.toHaveBeenCalled();
  });

  it("counts an error against the user of the request it happened in", async () => {
    client.getContext.mockReturnValueOnce({ distinctId: "user-2" });

    await reportException(client, new Error("boom"), { service: "backend", environment: "dev" });

    expect(client.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      "user-2",
      expect.any(Object),
    );
  });

  it("counts errors nobody is signed in for as one user per service", async () => {
    await reportException(client, new Error("boom"), { service: "backend", environment: "dev" });

    expect(client.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      "backend-server",
      expect.any(Object),
    );
  });

  it("does nothing when PostHog is not configured", async () => {
    await expect(
      reportException(null, new Error("boom"), { service: "web", environment: "local" }),
    ).resolves.toBeUndefined();
  });

  it("never throws, so a PostHog outage cannot change a response", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    client.captureExceptionImmediate.mockRejectedValueOnce(new Error("offline"));

    await expect(
      reportException(client, new Error("boom"), {
        service: "web",
        environment: "prod",
        immediate: true,
      }),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});
