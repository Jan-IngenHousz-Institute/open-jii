import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePlotlyResizeOnLayout } from "./use-plotly-resize-on-layout";

describe("usePlotlyResizeOnLayout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches a window resize event after the width changes (debounced ~50ms)", () => {
    const onResize = vi.fn();
    window.addEventListener("resize", onResize);

    const { rerender } = renderHook(
      ({ width }: { width: number }) => usePlotlyResizeOnLayout(width),
      { initialProps: { width: 0 } },
    );

    act(() => {
      rerender({ width: 800 });
    });

    expect(onResize).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(onResize).toHaveBeenCalled();
    window.removeEventListener("resize", onResize);
  });

  it("does not dispatch when the width is identical to the previous render", () => {
    const { rerender } = renderHook(
      ({ width }: { width: number }) => usePlotlyResizeOnLayout(width),
      { initialProps: { width: 800 } },
    );

    const onResize = vi.fn();
    window.addEventListener("resize", onResize);
    act(() => {
      rerender({ width: 800 });
      vi.advanceTimersByTime(60);
    });
    expect(onResize).not.toHaveBeenCalled();
    window.removeEventListener("resize", onResize);
  });

  it("ignores non-finite widths so initial layouts don't fire a phantom resize", () => {
    const { rerender } = renderHook(
      ({ width }: { width: number }) => usePlotlyResizeOnLayout(width),
      { initialProps: { width: NaN } },
    );

    const onResize = vi.fn();
    window.addEventListener("resize", onResize);
    act(() => {
      rerender({ width: NaN });
      vi.advanceTimersByTime(60);
    });
    expect(onResize).not.toHaveBeenCalled();
    window.removeEventListener("resize", onResize);
  });
});
