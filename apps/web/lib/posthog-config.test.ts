import { afterEach, describe, expect, it, vi } from "vitest";

import { dropEveryEvent } from "@repo/analytics";

import {
  POSTHOG_CLIENT_CONFIG,
  POSTHOG_SERVER_CONFIG,
  isDeployedBuild,
  tagEnvironment,
} from "./posthog-config";

describe("tagEnvironment", () => {
  it("names the environment and service on every event, keeping its own properties", () => {
    const tagged = tagEnvironment({ uuid: "u1", event: "$pageview", properties: { path: "/" } });

    expect(tagged?.properties).toEqual({ path: "/", environment: "local", service: "web" });
  });

  it("leaves an event another hook dropped dropped", () => {
    expect(tagEnvironment(null)).toBeNull();
  });
});

describe("a build on a developer's machine", () => {
  it("sends PostHog nothing from the browser or the server", () => {
    // Tests run as local, like a developer's machine.
    expect(isDeployedBuild).toBe(false);
    expect(POSTHOG_CLIENT_CONFIG.before_send).toBe(dropEveryEvent);
    expect(POSTHOG_SERVER_CONFIG.before_send).toBe(dropEveryEvent);
  });
});

describe("a deployed build", () => {
  afterEach(() => {
    vi.doUnmock("~/env");
    vi.resetModules();
  });

  it("tags every browser event and sends the server's errors as they are", async () => {
    vi.resetModules();
    vi.doMock("~/env", () => ({
      env: {
        NEXT_PUBLIC_ENVIRONMENT: "dev",
        NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
        NEXT_PUBLIC_POSTHOG_UI_HOST: "https://eu.posthog.com",
      },
    }));

    const deployed = await import("./posthog-config");

    expect(deployed.isDeployedBuild).toBe(true);
    expect(deployed.POSTHOG_CLIENT_CONFIG.before_send).toBe(deployed.tagEnvironment);
    expect(deployed.POSTHOG_SERVER_CONFIG.before_send).toBeUndefined();
  });
});
