import { stubBoundingRect } from "@/test/drag";
import { renderHook } from "@/test/test-utils";
import type { RefObject } from "react";
import { describe, expect, it } from "vitest";

import { useBackdropBounds } from "./use-backdrop-bounds";

function makeRef<T extends HTMLElement>(el: T | null): RefObject<T | null> {
  return { current: el };
}

function makeElement(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): HTMLElement {
  const el = document.createElement("div");
  stubBoundingRect(el, rect);
  return el;
}

describe("useBackdropBounds", () => {
  it("returns null when either ref is unset", () => {
    const { result } = renderHook(() =>
      useBackdropBounds(makeRef<HTMLElement>(null), makeRef<HTMLElement>(null)),
    );
    expect(result.current).toBeNull();
  });

  it("measures and returns canvas bounds relative to the outer element on mount", () => {
    const outer = makeElement({ left: 10, top: 20, width: 1000, height: 600 });
    const inner = makeElement({ left: 30, top: 50, width: 800, height: 500 });
    const { result } = renderHook(() => useBackdropBounds(makeRef(outer), makeRef(inner)));

    expect(result.current).toEqual({
      canvasLeft: 20,
      canvasTop: 30,
      canvasWidth: 800,
      gradientWidth: 1000,
      gradientHeight: 600,
    });
  });

  it("returns null when ResizeObserver is unavailable", () => {
    const stash = global.ResizeObserver;
    Object.defineProperty(global, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const outer = makeElement({ left: 0, top: 0, width: 100, height: 50 });
    const inner = makeElement({ left: 0, top: 0, width: 80, height: 40 });
    try {
      const { result } = renderHook(() => useBackdropBounds(makeRef(outer), makeRef(inner)));
      expect(result.current).toBeNull();
    } finally {
      Object.defineProperty(global, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: stash,
      });
    }
  });

  it("returns a stable reference when re-rendered with the same refs", () => {
    const outer = makeElement({ left: 0, top: 0, width: 1000, height: 600 });
    const inner = makeElement({ left: 0, top: 0, width: 800, height: 500 });
    const outerRef = makeRef(outer);
    const innerRef = makeRef(inner);
    const { result, rerender } = renderHook(() => useBackdropBounds(outerRef, innerRef));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("preserves canvasWidth equal to the inner element's measured width", () => {
    const outer = makeElement({ left: 0, top: 0, width: 1200, height: 800 });
    const inner = makeElement({ left: 50, top: 25, width: 1024, height: 720 });
    const { result } = renderHook(() => useBackdropBounds(makeRef(outer), makeRef(inner)));
    expect(result.current?.canvasWidth).toBe(1024);
    expect(result.current?.gradientWidth).toBe(1200);
  });
});
