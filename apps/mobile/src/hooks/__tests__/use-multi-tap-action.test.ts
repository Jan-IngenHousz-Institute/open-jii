// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMultiTapAction } from "../use-multi-tap-action";

describe("useMultiTapAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a function", () => {
    const { result } = renderHook(() => useMultiTapAction(vi.fn()));
    expect(typeof result.current).toBe("function");
  });

  it("calls onAction after 3 taps (default) within the 600ms window", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction));

    act(() => { result.current(); }); // tap 1 at 1000ms
    vi.setSystemTime(1500);
    act(() => { result.current(); }); // tap 2 at 1500ms (+500ms)
    vi.setSystemTime(2000);
    act(() => { result.current(); }); // tap 3 at 2000ms (+500ms) → fires

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not call onAction before reaching tapsRequired", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction));

    act(() => { result.current(); });
    vi.setSystemTime(1500);
    act(() => { result.current(); });

    expect(onAction).not.toHaveBeenCalled();
  });

  it("resets count when a tap falls outside the interval window", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction));

    act(() => { result.current(); }); // tap 1 at 1000ms
    vi.setSystemTime(2000); // +1000ms > 600ms, window expired
    act(() => { result.current(); }); // resets to count=1
    vi.setSystemTime(2500);
    act(() => { result.current(); }); // count=2, still < 3

    expect(onAction).not.toHaveBeenCalled();
  });

  it("resets after firing so subsequent taps start a fresh count", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction));

    act(() => { result.current(); });
    vi.setSystemTime(1500);
    act(() => { result.current(); });
    vi.setSystemTime(2000);
    act(() => { result.current(); }); // fires, count resets to 0

    // 2 more taps should not trigger a second fire (count only at 2)
    vi.setSystemTime(2500);
    act(() => { result.current(); });
    vi.setSystemTime(3000);
    act(() => { result.current(); });

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("respects custom tapsRequired", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction, { tapsRequired: 2 }));

    act(() => { result.current(); }); // tap 1
    vi.setSystemTime(1500);
    act(() => { result.current(); }); // tap 2 → fires

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("respects custom intervalMs", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction, { intervalMs: 200 }));

    act(() => { result.current(); }); // tap 1 at 1000ms
    vi.setSystemTime(1300); // +300ms > 200ms, window expired
    act(() => { result.current(); }); // resets to count=1
    vi.setSystemTime(1400); // +100ms within 200ms
    act(() => { result.current(); }); // count=2, still < 3

    expect(onAction).not.toHaveBeenCalled();
  });

  it("treats tap at exactly intervalMs boundary as outside the window (exclusive upper bound)", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useMultiTapAction(onAction, { intervalMs: 600 }));

    act(() => { result.current(); }); // tap 1 at 1000ms
    vi.setSystemTime(1600); // exactly at boundary → resets count to 1
    act(() => { result.current(); }); // count=1 (not 2)
    vi.setSystemTime(2100);
    act(() => { result.current(); }); // count=2, still < 3

    expect(onAction).not.toHaveBeenCalled();
  });
});
