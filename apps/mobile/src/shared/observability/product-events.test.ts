import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import { _resetPostHogClientForTests, getPostHogClient } from "./posthog";
import { trackProductEvent } from "./product-events";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock("posthog-react-native", () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.fetch = vi.fn();
    this.capture = capture;
  }),
}));

beforeEach(() => {
  vi.stubGlobal("__DEV__", true);
  capture.mockClear();
  _resetPostHogClientForTests();
  useEnvironmentStore.setState({ environment: "dev", isLoaded: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trackProductEvent", () => {
  it("captures the event with its properties once PostHog has started", () => {
    getPostHogClient();

    trackProductEvent("measurement:upload_succeed", { route: "s3" });

    expect(capture).toHaveBeenCalledWith("measurement:upload_succeed", { route: "s3" });
  });

  it("drops the event before PostHog has started, without starting it", () => {
    trackProductEvent("offline_data:prefetch_finish", { status: "ok", failures: 0 });

    expect(capture).not.toHaveBeenCalled();
  });
});
