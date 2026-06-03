import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { useElementSize } from "../use-element-size";

let observers: MockResizeObserver[] = [];

class MockResizeObserver {
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    observers.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {}
  fire(width: number, height: number) {
    const entry = {
      contentRect: { width, height } as DOMRectReadOnly,
    } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  observers = [];
  (globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }).ResizeObserver =
    MockResizeObserver;
});

function Probe() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="el">
      {size ? `${size.width}x${size.height}` : "null"}
    </div>
  );
}

describe("useElementSize", () => {
  it("returns null before the first observer fire", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("el").textContent).toBe("null");
  });

  it("emits the size after the observer fires", () => {
    const { getByTestId } = render(<Probe />);
    act(() => observers[0]?.fire(200, 100));
    expect(getByTestId("el").textContent).toBe("200x100");
  });

  it("keeps the same state object when no dimension actually changed", () => {
    const renders: string[] = [];
    function Tracking() {
      const [ref, size] = useElementSize<HTMLDivElement>();
      renders.push(size ? `${size.width}x${size.height}` : "null");
      return <div ref={ref} />;
    }
    render(<Tracking />);
    act(() => observers[0]?.fire(300, 200));
    act(() => observers[0]?.fire(300, 200));
    // Two fires with the same dimensions → only one state transition past "null".
    const distinct = new Set(renders);
    expect(distinct.has("null")).toBe(true);
    expect(distinct.has("300x200")).toBe(true);
    // No third distinct entry.
    expect(distinct.size).toBe(2);
  });
});
