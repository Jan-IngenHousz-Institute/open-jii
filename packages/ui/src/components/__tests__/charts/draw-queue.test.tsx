import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DrawQueue, useDrawTurn } from "../../charts/draw-queue";

describe("DrawQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets one chart draw at a time, the next in a later task", () => {
    const queue = new DrawQueue();
    const granted: string[] = [];

    const first = queue.request(() => granted.push("first"));
    queue.request(() => granted.push("second"));

    expect(granted).toEqual(["first"]);

    queue.release(first);
    expect(granted).toEqual(["first"]);

    vi.advanceTimersByTime(0);
    expect(granted).toEqual(["first", "second"]);
  });

  it("takes the turn back from a chart that never draws", () => {
    const queue = new DrawQueue();
    const granted: string[] = [];

    queue.request(() => granted.push("stuck"));
    queue.request(() => granted.push("next"));

    // A timeout scheduled while the fake clock ticks runs a millisecond later.
    vi.advanceTimersByTime(1_001);

    expect(granted).toEqual(["stuck", "next"]);
  });

  it("ignores a late release from a chart that no longer holds the turn", () => {
    const queue = new DrawQueue();
    const granted: string[] = [];

    const slow = queue.request(() => granted.push("slow"));
    const next = queue.request(() => granted.push("next"));
    queue.request(() => granted.push("last"));
    vi.advanceTimersByTime(1_001);

    queue.release(slow);
    vi.advanceTimersByTime(0);
    expect(granted).toEqual(["slow", "next"]);

    queue.release(next);
    vi.advanceTimersByTime(0);
    expect(granted).toEqual(["slow", "next", "last"]);
  });

  it("drops a chart that leaves before its turn, and hands on the turn of one that leaves with it", () => {
    const queue = new DrawQueue();
    const granted: string[] = [];

    const holder = queue.request(() => granted.push("holder"));
    const gone = queue.request(() => granted.push("gone"));
    queue.request(() => granted.push("stays"));

    queue.leave(gone);
    queue.leave(holder);
    vi.advanceTimersByTime(0);

    expect(granted).toEqual(["holder", "stays"]);
  });
});

describe("useDrawTurn", () => {
  it("waits until the chart is ready, then draws in turn and hands the turn on", () => {
    vi.useFakeTimers();
    const queue = new DrawQueue();
    const first = renderHook(({ isReady }) => useDrawTurn(isReady, queue), {
      initialProps: { isReady: false },
    });
    const second = renderHook(() => useDrawTurn(true, queue));

    expect(first.result.current.hasTurn).toBe(false);
    expect(second.result.current.hasTurn).toBe(true);

    first.rerender({ isReady: true });
    expect(first.result.current.hasTurn).toBe(false);

    act(() => {
      second.result.current.onDrawn();
      vi.advanceTimersByTime(0);
    });
    expect(first.result.current.hasTurn).toBe(true);
    vi.useRealTimers();
  });

  it("hands the turn on when a chart unmounts holding it", () => {
    vi.useFakeTimers();
    const queue = new DrawQueue();
    const holder = renderHook(() => useDrawTurn(true, queue));
    const waiting = renderHook(() => useDrawTurn(true, queue));

    act(() => {
      holder.unmount();
      vi.advanceTimersByTime(0);
    });

    expect(waiting.result.current.hasTurn).toBe(true);
    vi.useRealTimers();
  });
});
