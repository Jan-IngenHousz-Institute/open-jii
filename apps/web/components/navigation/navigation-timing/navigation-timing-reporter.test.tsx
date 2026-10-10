import { act, render } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigationTiming } from "~/lib/navigation-timing";

import { NavigationTimingReporter } from "./navigation-timing-reporter";

const posthog = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock("~/providers/posthog-context", () => ({ usePostHog: () => posthog }));

const EXPERIMENT = "/en-US/platform/experiments/3e5309b8-d5f2-4f7a-b20a-8b5e1e73a9f1";

function pendingQuery(queryClient: QueryClient, key: string) {
  let resolve: (value: string) => void = () => undefined;
  void queryClient.fetchQuery({
    queryKey: [key],
    queryFn: () => new Promise<string>((done) => (resolve = done)),
  });
  return (value: string) => resolve(value);
}

function expectSettledAfter(ms: number) {
  expect(posthog.capture).toHaveBeenCalledWith(
    "platform_navigation",
    expect.objectContaining({ settled_ms: ms }),
  );
}

describe("NavigationTimingReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    posthog.capture.mockClear();
    vi.mocked(usePathname).mockReturnValue(EXPERIMENT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a navigation once the data the new page asked for has arrived", async () => {
    const queryClient = new QueryClient();
    const resolve = pendingQuery(queryClient, "experiment");

    navigationTiming.start(EXPERIMENT, "push");
    render(<NavigationTimingReporter />, { queryClient });
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(posthog.capture).not.toHaveBeenCalled();

    await act(async () => {
      resolve("loaded");
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "platform_navigation",
      expect.objectContaining({
        route: "/en-US/platform/experiments/:id",
        navigation_type: "push",
      }),
    );
    expectSettledAfter(500);
  });

  it("waits for a query that starts only when another one lands", async () => {
    const queryClient = new QueryClient();
    const resolveFirst = pendingQuery(queryClient, "tables");

    navigationTiming.start(EXPERIMENT, "push");
    render(<NavigationTimingReporter />, { queryClient });

    let resolveSecond: (value: string) => void = () => undefined;
    await act(async () => {
      resolveFirst("tables");
      await vi.advanceTimersByTimeAsync(50);
      resolveSecond = pendingQuery(queryClient, "rows");
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(posthog.capture).not.toHaveBeenCalled();

    await act(async () => {
      resolveSecond("rows");
      await vi.advanceTimersByTimeAsync(100);
    });

    expectSettledAfter(450);
  });

  it("does not settle while the page still shows its loading screen", async () => {
    const queryClient = new QueryClient();

    navigationTiming.start(EXPERIMENT, "push");
    const release = navigationTiming.holdLoadingScreen();
    render(<NavigationTimingReporter />, { queryClient });
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(posthog.capture).not.toHaveBeenCalled();

    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(100);
    });

    expectSettledAfter(300);
  });

  it("reports nothing for a page that was not reached by a client navigation", async () => {
    render(<NavigationTimingReporter />);
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
