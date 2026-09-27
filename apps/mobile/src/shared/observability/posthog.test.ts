import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "~/shared/observability/logger";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import {
  _resetPostHogClientForTests,
  dropSdkNoise,
  getPostHogClient,
  tagEnvironment,
} from "./posthog";

const { constructed, captureException } = vi.hoisted(() => {
  const options: unknown[] = [];
  return { constructed: options, captureException: vi.fn() };
});

vi.mock("posthog-react-native", () => ({
  default: vi.fn(function (this: Record<string, unknown>, _key: string, options: unknown) {
    constructed.push(options);
    this.fetch = vi.fn();
    this.captureLog = vi.fn();
    this.captureException = captureException;
  }),
}));

function exception(...types: string[]) {
  return {
    event: "$exception",
    properties: { $exception_list: types.map((type) => ({ type, value: "boom" })) },
  };
}

beforeEach(() => {
  vi.stubGlobal("__DEV__", false);
  constructed.length = 0;
  captureException.mockClear();
  _resetPostHogClientForTests();
  useEnvironmentStore.setState({ environment: "dev", isLoaded: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dropSdkNoise", () => {
  it("drops the SDK's own failed uploads", () => {
    expect(dropSdkNoise(exception("PostHogFetchNetworkError", "Error"))).toBeNull();
    expect(dropSdkNoise(exception("PostHogFetchHttpError"))).toBeNull();
  });

  it("keeps the app's own exceptions and every other event", () => {
    const appError = exception("TypeError");
    const screen = { event: "$screen", properties: { $screen_name: "/measure" } };

    expect(dropSdkNoise(appError)).toBe(appError);
    expect(dropSdkNoise(screen)).toBe(screen);
    expect(dropSdkNoise(null)).toBeNull();
  });
});

describe("tagEnvironment", () => {
  it("names the environment selected when the event is sent", () => {
    const first = tagEnvironment({ event: "x", properties: { a: 1 } });
    useEnvironmentStore.setState({ environment: "prod" });
    const second = tagEnvironment({ event: "x" });

    expect(first?.properties).toEqual({
      a: 1,
      environment: "dev",
      service: "mobile",
      build: "release",
    });
    expect(second?.properties).toMatchObject({ environment: "prod", service: "mobile" });
  });

  it("marks events from a development build, so triage can set them aside", () => {
    vi.stubGlobal("__DEV__", true);

    expect(tagEnvironment({ event: "x" })?.properties).toMatchObject({ build: "development" });
  });
});

describe("getPostHogClient", () => {
  it("filters noise before tagging, so a dropped event is never tagged", () => {
    getPostHogClient();

    expect(constructed[0]).toMatchObject({ before_send: [dropSdkNoise, tagEnvironment] });
  });

  it("reports error log lines through the log sink rather than console autocapture", () => {
    getPostHogClient();
    const cause = new Error("prefetch failed");

    createLogger("prefetch").error("Failed to prefetch offline data", { err: cause });

    expect(constructed[0]).toMatchObject({
      errorTracking: { autocapture: { console: [] } },
      logs: { serviceName: "mobile" },
    });
    expect(captureException).toHaveBeenCalledWith(
      cause,
      expect.objectContaining({ ns: "prefetch" }),
    );
  });

  it("leaves a development build's logs on the console", () => {
    vi.stubGlobal("__DEV__", true);
    getPostHogClient();

    createLogger("prefetch").error("Failed to prefetch offline data", { err: new Error("x") });

    expect(captureException).not.toHaveBeenCalled();
  });
});
