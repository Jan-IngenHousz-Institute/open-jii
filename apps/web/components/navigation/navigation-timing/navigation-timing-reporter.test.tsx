import { act, render } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { navigationTiming } from "~/lib/navigation-timing";

import { NavigationTimingReporter } from "./navigation-timing-reporter";

const posthog = vi.hoisted(() => ({ capture: vi.fn() }));

vi.mock("~/providers/posthog-context", () => ({ usePostHog: () => posthog }));

const EXPERIMENT = "/en-US/platform/experiments/3e5309b8-d5f2-4f7a-b20a-8b5e1e73a9f1";

describe("NavigationTimingReporter", () => {
  it("reports a navigation once the data the new page asked for has arrived", async () => {
    vi.useFakeTimers();
    posthog.capture.mockClear();
    vi.mocked(usePathname).mockReturnValue(EXPERIMENT);
    const queryClient = new QueryClient();
    let resolve: (value: string) => void = () => undefined;
    void queryClient.fetchQuery({
      queryKey: ["experiment"],
      queryFn: () => new Promise<string>((done) => (resolve = done)),
    });

    navigationTiming.start(EXPERIMENT, "push");
    render(<NavigationTimingReporter />, { queryClient });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(posthog.capture).not.toHaveBeenCalled();

    await act(async () => {
      resolve("loaded");
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "platform_navigation",
      expect.objectContaining({
        route: "/en-US/platform/experiments/:id",
        navigation_type: "push",
      }),
    );
    vi.useRealTimers();
  });

  it("reports nothing for a page that was not reached by a client navigation", async () => {
    vi.useFakeTimers();
    posthog.capture.mockClear();
    vi.mocked(usePathname).mockReturnValue(EXPERIMENT);

    render(<NavigationTimingReporter />);
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(posthog.capture).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
