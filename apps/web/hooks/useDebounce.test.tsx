import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));

    expect(result.current[0]).toBe("initial");
    expect(result.current[1]).toBe(false); // isDebounced should be false initially due to useEffect

    // Complete the initial debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current[0]).toBe("initial");
    expect(result.current[1]).toBe(true); // Now isDebounced should be true
  });

  it("should debounce value changes with default delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    expect(result.current[0]).toBe("initial");
    expect(result.current[1]).toBe(false); // Initially false due to useEffect

    // Change the value
    rerender({ value: "updated" });

    // Immediately after change, isDebounced should be false
    expect(result.current[0]).toBe("initial"); // Value not updated yet
    expect(result.current[1]).toBe(false); // Debouncing in progress

    // Fast-forward time by less than delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current[0]).toBe("initial"); // Still old value
    expect(result.current[1]).toBe(false); // Still debouncing

    // Fast-forward time to complete delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe("updated"); // Value updated
    expect(result.current[1]).toBe(true); // Debouncing complete
  });

  it("should use custom delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    expect(result.current[1]).toBe(false);

    // Fast-forward by 300ms (less than custom delay)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current[0]).toBe("initial");
    expect(result.current[1]).toBe(false);

    // Fast-forward to complete custom delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current[0]).toBe("updated");
    expect(result.current[1]).toBe(true);
  });

  it("should cancel previous timer when value changes rapidly", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    // First change
    rerender({ value: "first" });
    expect(result.current[1]).toBe(false);

    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Second change before first debounce completes
    rerender({ value: "second" });
    expect(result.current[0]).toBe("initial"); // Still initial
    expect(result.current[1]).toBe(false); // Still debouncing

    // Advance time partially again
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current[0]).toBe("initial"); // Still initial
    expect(result.current[1]).toBe(false); // Still debouncing

    // Complete the second debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe("second"); // Should be second, not first
    expect(result.current[1]).toBe(true);
  });

  it("should handle delay changes", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "initial", delay: 300 },
    });

    // Change value and delay
    rerender({ value: "updated", delay: 500 });

    expect(result.current[1]).toBe(false);

    // Advance by original delay (300ms) - should not complete
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current[0]).toBe("initial");
    expect(result.current[1]).toBe(false);

    // Advance by remaining time for new delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current[0]).toBe("updated");
    expect(result.current[1]).toBe(true);
  });

  it("should work with different data types", () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      {
        initialProps: { value: 42 },
      },
    );

    numberRerender({ value: 84 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(numberResult.current[0]).toBe(84);

    // Test with object
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      {
        initialProps: { value: { id: 1, name: "test" } },
      },
    );

    const newObj = { id: 2, name: "updated" };
    objectRerender({ value: newObj });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(objectResult.current[0]).toBe(newObj);

    // Test with array
    const { result: arrayResult, rerender: arrayRerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      {
        initialProps: { value: [1, 2, 3] },
      },
    );

    const newArray = [4, 5, 6];
    arrayRerender({ value: newArray });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(arrayResult.current[0]).toBe(newArray);
  });

  it("should handle zero delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 0), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });

    expect(result.current[1]).toBe(false);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current[0]).toBe("updated");
    expect(result.current[1]).toBe(true);
  });

  it("should cleanup timer on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const { result, rerender, unmount } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });
    expect(result.current[1]).toBe(false);

    // Unmount before timer completes
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should handle boolean values", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: true },
    });

    expect(result.current[0]).toBe(true);
    expect(result.current[1]).toBe(false); // Initially false due to useEffect

    rerender({ value: false });
    expect(result.current[1]).toBe(false);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(false);
    expect(result.current[1]).toBe(true);
  });

  it("should handle null and undefined values", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: null as string | null | undefined },
    });

    expect(result.current[0]).toBe(null);

    rerender({ value: "not null" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe("not null");

    rerender({ value: undefined });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(undefined);
  });

  it("should maintain correct isDebounced state throughout multiple rapid changes", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    expect(result.current[1]).toBe(false); // Initially false due to useEffect

    // Rapid changes
    rerender({ value: "change1" });
    expect(result.current[1]).toBe(false);

    rerender({ value: "change2" });
    expect(result.current[1]).toBe(false);

    rerender({ value: "change3" });
    expect(result.current[1]).toBe(false);

    // Complete debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current[0]).toBe("change3");
    expect(result.current[1]).toBe(true);
  });
});
