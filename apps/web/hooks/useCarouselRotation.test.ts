import { act, renderHook } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCarouselRotation } from "./useCarouselRotation";

const INTERVAL_MS = 6000;

/** A carousel of `count` slides that announces each move, as Embla does. */
function fakeCarousel(count: number) {
  const listeners = new Set<() => void>();
  let index = 0;

  return {
    on: (_event: "select", callback: () => void) => listeners.add(callback),
    off: (_event: "select", callback: () => void) => listeners.delete(callback),
    selectedScrollSnap: () => index,
    scrollSnapList: () => Array.from({ length: count }, (_, slide) => slide),
    scrollNext: vi.fn(() => {
      index = (index + 1) % count;
      listeners.forEach((listener) => listener());
    }),
  };
}

function preferReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("useCarouselRotation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("moves to the next slide after each interval", () => {
    const carousel = fakeCarousel(3);
    const { result } = renderHook(() => useCarouselRotation(carousel, INTERVAL_MS));

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(result.current.selected).toBe(1);

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(result.current.selected).toBe(2);
  });

  it("holds while the pointer or focus is on it", () => {
    const carousel = fakeCarousel(3);
    const { result } = renderHook(() => useCarouselRotation(carousel, INTERVAL_MS));

    act(() => {
      result.current.holdHandlers.onMouseEnter();
    });
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    act(() => {
      result.current.holdHandlers.onMouseLeave();
    });
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("stops when the reader pauses it, and goes on when they resume", () => {
    const carousel = fakeCarousel(3);
    const { result } = renderHook(() => useCarouselRotation(carousel, INTERVAL_MS));

    act(() => {
      result.current.toggleRunning();
    });
    expect(result.current.isRunning).toBe(false);
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleRunning();
    });
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("starts still for a reader who asked for less motion, until they press play", () => {
    preferReducedMotion(true);
    const carousel = fakeCarousel(3);
    const { result } = renderHook(() => useCarouselRotation(carousel, INTERVAL_MS));

    expect(result.current.isRunning).toBe(false);
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(carousel.scrollNext).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleRunning();
    });
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(carousel.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("does not rotate a single slide", () => {
    const carousel = fakeCarousel(1);
    renderHook(() => useCarouselRotation(carousel, INTERVAL_MS));

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(carousel.scrollNext).not.toHaveBeenCalled();
  });
});
