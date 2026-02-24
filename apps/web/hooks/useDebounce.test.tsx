import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns initial value and settles after delay", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));

    expect(result.current[0]).toBe("hello");
    expect(result.current[1]).toBe(false);

    void act(() => vi.advanceTimersByTime(300));

    expect(result.current[0]).toBe("hello");
    expect(result.current[1]).toBe(true);
  });

  it("debounces value changes", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    expect(result.current[0]).toBe("a");
    expect(result.current[1]).toBe(false);

    void act(() => vi.advanceTimersByTime(300));
    expect(result.current[0]).toBe("b");
    expect(result.current[1]).toBe(true);
  });

  it("resets timer on rapid changes", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    void act(() => vi.advanceTimersByTime(100));

    rerender({ v: "c" });
    void act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe("a"); // still waiting

    void act(() => vi.advanceTimersByTime(100));
    expect(result.current[0]).toBe("c"); // skipped "b"
    expect(result.current[1]).toBe(true);
  });

  it("respects custom delay", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 500), {
      initialProps: { v: "x" },
    });

    rerender({ v: "y" });
    void act(() => vi.advanceTimersByTime(300));
    expect(result.current[0]).toBe("x");

    void act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe("y");
  });

  it("cleans up on unmount", () => {
    const spy = vi.spyOn(global, "clearTimeout");
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    unmount();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
