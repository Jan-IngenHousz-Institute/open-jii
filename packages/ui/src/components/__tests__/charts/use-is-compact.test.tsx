import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { facetTierStyles, useChartSizing, useIsCompact } from "../../charts/use-is-compact";

let observers: MockResizeObserver[] = [];

function buildEntry(width: number, height: number): ResizeObserverEntry {
  const target = document.createElement("div");
  const rect: DOMRectReadOnly = {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  const size: ReadonlyArray<ResizeObserverSize> = [{ inlineSize: width, blockSize: height }];
  return {
    target,
    contentRect: rect,
    borderBoxSize: size,
    contentBoxSize: size,
    devicePixelContentBoxSize: size,
  };
}

class MockResizeObserver implements ResizeObserver {
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    observers.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  fire(width: number, height: number): void {
    this.callback([buildEntry(width, height)], this);
  }
}

beforeEach(() => {
  observers = [];
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });
});

function SizingProbe({ grid }: { grid?: { rows: number; columns: number } }) {
  const [ref, sizing] = useChartSizing<HTMLDivElement>(grid ? { grid } : {});
  return (
    <div ref={ref} data-testid="probe">
      {JSON.stringify(sizing)}
    </div>
  );
}

function IsCompactProbe() {
  const [ref, isCompact] = useIsCompact<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="probe">
      {isCompact ? "yes" : "no"}
    </div>
  );
}

describe("useChartSizing", () => {
  it("settles outer tiers when the observer fires a wide container", () => {
    const { getByTestId } = render(<SizingProbe />);
    act(() => observers[0]?.fire(1200, 800));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.snug).toBe(false);
    expect(parsed.compact).toBe(false);
    expect(parsed.veryCompact).toBe(false);
    expect(parsed.ultraCompact).toBe(false);
  });

  it("flips outer tiers once the container shrinks past the compact breakpoint", () => {
    const { getByTestId } = render(<SizingProbe />);
    act(() => observers[0]?.fire(400, 300));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.snug).toBe(true);
    expect(parsed.compact).toBe(true);
    expect(parsed.veryCompact).toBe(false);
  });

  it("applies the cell breakpoints when a facet grid is configured", () => {
    const { getByTestId } = render(<SizingProbe grid={{ rows: 2, columns: 4 }} />);
    act(() => observers[0]?.fire(800, 500));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    // 800x500 over 4 cols / 2 rows = 200x250 per cell, lands in cell-compact.
    expect(parsed.cellCompact).toBe(true);
  });

  it("trips veryCompact and ultraCompact when the container is tiny", () => {
    const { getByTestId } = render(<SizingProbe />);
    act(() => observers[0]?.fire(180, 120));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.snug).toBe(true);
    expect(parsed.compact).toBe(true);
    expect(parsed.veryCompact).toBe(true);
    expect(parsed.ultraCompact).toBe(true);
  });

  it("trips veryCompact but not ultraCompact between the two outer breakpoints", () => {
    const { getByTestId } = render(<SizingProbe />);
    act(() => observers[0]?.fire(240, 180));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.veryCompact).toBe(true);
    expect(parsed.ultraCompact).toBe(false);
  });

  it("mirrors cell tiers to outer tiers when no grid is configured (1x1)", () => {
    const { getByTestId } = render(<SizingProbe />);
    // 400x300 → outer compact (compact: w<480 OR h<320), unfaceted so cell
    // tiers use OUTER breakpoints, not CELL_*.
    act(() => observers[0]?.fire(400, 300));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.compact).toBe(true);
    expect(parsed.cellCompact).toBe(true);
    expect(parsed.snug).toBe(parsed.cellSnug);
    expect(parsed.veryCompact).toBe(parsed.cellVeryCompact);
  });

  it("trips per-cell ultraCompact when faceted cells fall below cell-ultra width", () => {
    const { getByTestId } = render(<SizingProbe grid={{ rows: 1, columns: 8 }} />);
    // 800/8 = 100, well under CELL_ULTRA_COMPACT (120/80).
    act(() => observers[0]?.fire(800, 500));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(parsed.cellUltraCompact).toBe(true);
    // Outer container is wide; outer tiers untouched.
    expect(parsed.compact).toBe(false);
  });

  it("does not flip cell tiers from outer when grid is exactly 1x1", () => {
    // 1x1 grid is the no-facet sentinel: outer tiers used for cells too.
    const { getByTestId } = render(<SizingProbe grid={{ rows: 1, columns: 1 }} />);
    act(() => observers[0]?.fire(1200, 800));
    const parsed = JSON.parse(getByTestId("probe").textContent ?? "{}");
    // Wide container: nothing trips, including the cell tiers.
    expect(parsed.cellSnug).toBe(false);
    expect(parsed.cellCompact).toBe(false);
  });
});

describe("useIsCompact", () => {
  it("returns false when the container is wide", () => {
    const { getByTestId } = render(<IsCompactProbe />);
    act(() => observers[0]?.fire(1200, 800));
    expect(getByTestId("probe").textContent).toBe("no");
  });

  it("returns true once the container falls below the compact threshold", () => {
    const { getByTestId } = render(<IsCompactProbe />);
    act(() => observers[0]?.fire(300, 200));
    expect(getByTestId("probe").textContent).toBe("yes");
  });
});

describe("facetTierStyles", () => {
  it("returns progressively smaller cell-title font sizes as the cell tier tightens", () => {
    const base = {
      snug: false,
      compact: false,
      veryCompact: false,
      ultraCompact: false,
      cellSnug: false,
      cellCompact: false,
      cellVeryCompact: false,
      cellUltraCompact: false,
    };
    expect(facetTierStyles(base).cellTitleFontSize).toBe(12);
    expect(facetTierStyles({ ...base, cellSnug: true }).cellTitleFontSize).toBe(11);
    expect(facetTierStyles({ ...base, cellCompact: true }).cellTitleFontSize).toBe(10);
    expect(facetTierStyles({ ...base, cellVeryCompact: true }).cellTitleFontSize).toBe(9);
  });
});
