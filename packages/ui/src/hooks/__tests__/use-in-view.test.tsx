import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { useInView } from "../use-in-view";

let observers: MockIntersectionObserver[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  callback: IntersectionObserverCallback;
  root: Element | Document | null;
  rootMargin: string;
  scrollMargin = "0px";
  thresholds: ReadonlyArray<number>;
  disconnected = false;

  constructor(cb: IntersectionObserverCallback, init: IntersectionObserverInit = {}) {
    this.callback = cb;
    this.root = init.root ?? null;
    this.rootMargin = init.rootMargin ?? "0px";
    this.thresholds = Array.isArray(init.threshold) ? init.threshold : [init.threshold ?? 0];
    observers.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  fire(isIntersecting: boolean): void {
    const target = document.createElement("div");
    const entry: IntersectionObserverEntry = {
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      target,
      time: 0,
      rootBounds: null,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
    };
    this.callback([entry], this);
  }
}

beforeEach(() => {
  observers = [];
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
});

function Probe({ once }: { once?: boolean } = {}) {
  const [ref, inView] = useInView<HTMLDivElement>({ once });
  return (
    <div ref={ref} data-testid="probe">
      {inView ? "in" : "out"}
    </div>
  );
}

describe("useInView", () => {
  it("starts out of view before the first intersection callback", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("probe").textContent).toBe("out");
  });

  it("flips to in-view when the observer reports an intersection", () => {
    const { getByTestId } = render(<Probe />);
    act(() => observers[0]?.fire(true));
    expect(getByTestId("probe").textContent).toBe("in");
  });

  it("disconnects the observer the first time it sees an intersection when `once` is true (default)", () => {
    render(<Probe />);
    act(() => observers[0]?.fire(true));
    expect(observers[0]?.disconnected).toBe(true);
  });

  it("toggles back to out of view when `once` is false", () => {
    const { getByTestId } = render(<Probe once={false} />);
    act(() => observers[0]?.fire(true));
    expect(getByTestId("probe").textContent).toBe("in");
    act(() => observers[0]?.fire(false));
    expect(getByTestId("probe").textContent).toBe("out");
  });
});
