import { act, renderHook } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "./use-count-up";

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("useCountUp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays at zero until activated", () => {
    mockReducedMotion(true);

    const { result } = renderHook(() => useCountUp(500, false));

    expect(result.current).toBe(0);
  });

  it("snaps straight to the target when motion is reduced", () => {
    mockReducedMotion(true);

    const { result } = renderHook(() => useCountUp(500, true));

    expect(result.current).toBe(500);
  });

  it("animates up to the target and stops there", () => {
    mockReducedMotion(false);
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });

    const { result } = renderHook(() => useCountUp(500, true));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThanOrEqual(500);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(500);
  });

  it("follows the target when it changes", () => {
    mockReducedMotion(true);

    const { result, rerender } = renderHook(({ target }) => useCountUp(target, true), {
      initialProps: { target: 500 },
    });
    expect(result.current).toBe(500);

    act(() => {
      rerender({ target: 900 });
    });

    expect(result.current).toBe(900);
  });
});
