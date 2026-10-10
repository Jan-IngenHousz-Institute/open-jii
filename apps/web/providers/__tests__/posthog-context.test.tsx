import { act, renderHook } from "@testing-library/react";
import type { PostHog } from "posthog-js";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PostHogContext, useFeatureFlagEnabled } from "../posthog-context";

vi.unmock("~/providers/posthog-context");

/** An uninitialised client whose flags load when the test says so. */
async function createClient() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const { PostHog } = await vi.importActual<typeof import("posthog-js")>("posthog-js");
  const client = new PostHog();
  const flags: Record<string, boolean> = {};
  const listeners: (() => void)[] = [];

  vi.spyOn(client, "isFeatureEnabled").mockImplementation((flag) => flags[flag]);
  vi.spyOn(client, "onFeatureFlags").mockImplementation((listener) => {
    listeners.push(() => listener([], {}));
    return () => undefined;
  });

  const loadFlags = (next: Record<string, boolean>) => {
    Object.assign(flags, next);
    listeners.forEach((listener) => listener());
  };
  return { client, loadFlags };
}

function withClient(client: PostHog | null) {
  return ({ children }: { children: ReactNode }) => (
    <PostHogContext.Provider value={client}>{children}</PostHogContext.Provider>
  );
}

describe("useFeatureFlagEnabled", () => {
  it("has no value while PostHog is still loading", () => {
    const { result } = renderHook(() => useFeatureFlagEnabled("iot-devices"), {
      wrapper: withClient(null),
    });

    expect(result.current).toBeUndefined();
  });

  it("follows the flag once PostHog has loaded its flags", async () => {
    const { client, loadFlags } = await createClient();
    const { result } = renderHook(() => useFeatureFlagEnabled("iot-devices"), {
      wrapper: withClient(client),
    });
    expect(result.current).toBeUndefined();

    act(() => loadFlags({ "iot-devices": true }));

    expect(result.current).toBe(true);
  });
});
