// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMultiTapReveal } from "../use-multi-tap-reveal";

describe("useMultiTapReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not visible initially", () => {
    const { result } = renderHook(() => useMultiTapReveal());
    expect(result.current.isVisible).toBe(false);
  });

  it("returns a handleTap function", () => {
    const { result } = renderHook(() => useMultiTapReveal());
    expect(typeof result.current.handleTap).toBe("function");
  });

  it("becomes visible after 4 taps (default) within the window", () => {
    const { result } = renderHook(() => useMultiTapReveal());

    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(1500);
    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(2000);
    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(2500);
    act(() => {
      result.current.handleTap();
    }); // 4th tap → visible

    expect(result.current.isVisible).toBe(true);
  });

  it("remains hidden before reaching tapsRequired", () => {
    const { result } = renderHook(() => useMultiTapReveal());

    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(1500);
    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(2000);
    act(() => {
      result.current.handleTap();
    }); // only 3 of 4

    expect(result.current.isVisible).toBe(false);
  });

  it("respects custom tapsRequired", () => {
    const { result } = renderHook(() => useMultiTapReveal({ tapsRequired: 2 }));

    act(() => {
      result.current.handleTap();
    });
    vi.setSystemTime(1500);
    act(() => {
      result.current.handleTap();
    }); // 2nd tap → visible

    expect(result.current.isVisible).toBe(true);
  });

  it("respects custom intervalMs", () => {
    const { result } = renderHook(() => useMultiTapReveal({ tapsRequired: 2, intervalMs: 200 }));

    act(() => {
      result.current.handleTap();
    }); // tap 1 at 1000ms
    vi.setSystemTime(1300); // +300ms > 200ms, window expired → resets
    act(() => {
      result.current.handleTap();
    }); // count=1 (reset)

    expect(result.current.isVisible).toBe(false);
  });
});
