import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initializePostHogServer, isDemoModeEnabled, shutdownPostHog } from "./server";

const enabled = vi.hoisted(() =>
  vi.fn<(flag: string, id: string, options: unknown) => Promise<boolean | undefined>>(),
);
vi.mock("posthog-node", () => ({
  PostHog: class {
    isFeatureEnabled = enabled;
    shutdown = vi.fn().mockResolvedValue(undefined);
  },
}));

describe("demo mode availability", () => {
  beforeEach(async () => {
    enabled.mockReset();
    await initializePostHogServer("synthetic-key", { host: "https://example.test" });
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await shutdownPostHog();
  });

  it.each([true, false, undefined])(
    "evaluates %s without a person or flag event",
    async (value) => {
      enabled.mockResolvedValue(value);
      expect(await isDemoModeEnabled()).toBe(value === true);
      expect(enabled).toHaveBeenCalledWith("demo-mode", "anonymous", {
        personProperties: undefined,
        sendFeatureFlagEvents: false,
      });
    },
  );

  it("fails closed on an unavailable flag service", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    enabled.mockRejectedValue(new Error("synthetic outage"));
    expect(await isDemoModeEnabled()).toBe(false);
  });

  it("fails closed within two seconds when the flag service hangs", async () => {
    vi.useFakeTimers();
    enabled.mockImplementation(() => new Promise(() => undefined));
    const result = isDemoModeEnabled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
