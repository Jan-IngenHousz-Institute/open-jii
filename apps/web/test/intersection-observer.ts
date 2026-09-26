import { act } from "@testing-library/react";
import { vi } from "vitest";

type IntersectionCallback = (entries: { isIntersecting: boolean }[]) => void;

interface StubbedObserver {
  callback: IntersectionCallback;
  options: IntersectionObserverInit | undefined;
  active: boolean;
}

/**
 * Replaces `IntersectionObserver` with a stub the test drives by hand. jsdom
 * has none, and the in-view hook then treats everything as visible, which
 * hides lazy-mount behaviour. A disconnected observer stops receiving entries,
 * as the real one does. Pair with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function stubIntersectionObserver() {
  const observers: StubbedObserver[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      private readonly entry: StubbedObserver;
      constructor(callback: IntersectionCallback, options?: IntersectionObserverInit) {
        this.entry = { callback, options, active: true };
        observers.push(this.entry);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = () => {
        this.entry.active = false;
      };
    },
  );
  const intersect = (isIntersecting: boolean) => {
    act(() => {
      for (const observer of observers) {
        if (observer.active) {
          observer.callback([{ isIntersecting }]);
        }
      }
    });
  };
  return {
    intersect,
    activeObservers: () => observers.filter((o) => o.active).length,
    rootMargins: () => observers.map((o) => o.options?.rootMargin),
  };
}
