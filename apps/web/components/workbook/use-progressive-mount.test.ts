import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressiveMount } from "./use-progressive-mount";

describe("useProgressiveMount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts a list the server renders whole at once", () => {
    const { result } = renderHook(() => useProgressiveMount(100));

    expect(result.current.mounted).toBe(100);
  });

  it("mounts a long list a batch per task until all of it is in", () => {
    const { result } = renderHook(() => useProgressiveMount(150));

    expect(result.current.mounted).toBe(40);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.mounted).toBe(80);

    // Each batch schedules the next once it has committed.
    for (const expected of [120, 150]) {
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(result.current.mounted).toBe(expected);
    }

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.mounted).toBe(150);
  });

  it("mounts everything at once when asked", () => {
    const { result } = renderHook(() => useProgressiveMount(900));

    act(() => {
      result.current.mountAll();
    });

    expect(result.current.mounted).toBe(900);
  });
});
