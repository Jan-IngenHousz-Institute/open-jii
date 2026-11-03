import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOW } from "~/test/render-status";

import { useNow } from "../use-now";

const TICK_MS = 15_000;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

describe("useNow", () => {
  it("starts at the device clock", () => {
    const { result } = renderHook(() => useNow(0));

    expect(result.current).toBe(NOW);
  });

  it("moves the device clock by the server's offset", () => {
    const { result } = renderHook(() => useNow(-3 * 3_600_000));

    expect(result.current).toBe(NOW - 3 * 3_600_000);
  });

  it("follows a changed offset at once", () => {
    const { result, rerender } = renderHook(({ offset }) => useNow(offset), {
      initialProps: { offset: 0 },
    });

    rerender({ offset: 60_000 });

    expect(result.current).toBe(NOW + 60_000);
  });

  it("ticks every fifteen seconds", async () => {
    const { result } = renderHook(() => useNow(0));

    await advance(TICK_MS - 1);
    expect(result.current).toBe(NOW);

    await advance(1);
    expect(result.current).toBe(NOW + TICK_MS);

    await advance(TICK_MS);
    expect(result.current).toBe(NOW + 2 * TICK_MS);
  });

  it("stops ticking on unmount", () => {
    const { unmount } = renderHook(() => useNow(0));
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
