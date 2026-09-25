import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useIsIdle } from "./useIsIdle";

describe("useIsIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("turns idle after the given time without input", () => {
    const { result } = renderHook(() => useIsIdle(1000));

    expect(result.current).toBe(false);

    void act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);

    void act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("wakes on input and restarts the countdown", () => {
    const { result } = renderHook(() => useIsIdle(1000));

    void act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    void act(() => window.dispatchEvent(new KeyboardEvent("keydown")));
    expect(result.current).toBe(false);

    void act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);

    void act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("counts a scroll inside a panel as input", () => {
    const { result } = renderHook(() => useIsIdle(1000));
    const panel = document.createElement("div");
    document.body.appendChild(panel);

    void act(() => vi.advanceTimersByTime(900));
    void act(() => panel.dispatchEvent(new Event("scroll")));
    void act(() => vi.advanceTimersByTime(900));

    expect(result.current).toBe(false);
    panel.remove();
  });

  it("stops listening on unmount", () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIsIdle(1000));

    unmount();

    expect(removeListener).toHaveBeenCalledWith("keydown", expect.any(Function), {
      capture: true,
    });
    removeListener.mockRestore();
  });
});
