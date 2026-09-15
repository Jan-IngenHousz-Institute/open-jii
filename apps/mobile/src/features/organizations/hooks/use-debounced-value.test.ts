import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value straight away", () => {
    const { result } = renderHook(() => useDebouncedValue("lab"));

    expect(result.current).toBe("lab");
  });

  it("trails a change by the default 250 ms", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "l" },
    });

    rerender({ value: "la" });
    expect(result.current).toBe("l");

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current).toBe("la");
  });

  it("only settles on the last value of a burst of keystrokes", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "" },
    });

    for (const value of ["l", "la", "lab"]) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(100));
    }
    expect(result.current).toBe("");

    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current).toBe("lab");
  });

  it("honours a custom delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1000), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe("b");
  });
});
