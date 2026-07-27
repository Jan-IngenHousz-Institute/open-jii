import { act, renderHook } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveCapture } from "./useLiveCapture";

interface Deferred {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/**
 * A controllable read: each call hands back a promise the test settles
 * explicitly, so tick timing is fully deterministic under fake timers.
 */
function deferredRead() {
  const pending: Deferred[] = [];
  const read = vi.fn(
    () =>
      new Promise<unknown>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  );
  return { read, pending };
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useLiveCapture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules the next read only after the previous one settles", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    expect(read).toHaveBeenCalledTimes(1);

    // Read overruns the interval by far: no second command is issued.
    await advance(5000);
    expect(read).toHaveBeenCalledTimes(1);

    await settle(() => pending[0].resolve(340.5));
    expect(result.current.points).toEqual([{ t: expect.any(Number) as number, value: 340.5 }]);

    // Only now does the interval arm the next read.
    await advance(999);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stop() drops an in-flight result and cancels the pending timer", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    expect(result.current.isCapturing).toBe(true);

    await settle(() => result.current.stop());
    await settle(() => pending[0].resolve(340.5));

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.points).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await advance(10_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("rolls the points window at maxPoints while sampleCount keeps counting", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000, maxPoints: 3 }));

    await settle(() => result.current.start());
    for (let i = 0; i < 5; i++) {
      await settle(() => pending[i].resolve(100 + i));
      await advance(1000);
    }

    expect(result.current.sampleCount).toBe(5);
    expect(result.current.points.map((p) => p.value)).toEqual([102, 103, 104]);
  });

  it("skips non-numeric replies but keeps looping", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    await settle(() => pending[0].resolve("error:unknown_command"));

    expect(result.current.points).toEqual([]);
    expect(result.current.error).toBe("Non-numeric reading");
    expect(result.current.isCapturing).toBe(true);

    await advance(1000);
    await settle(() => pending[1].resolve(341));

    expect(result.current.points.map((p) => p.value)).toEqual([341]);
    expect(result.current.error).toBeNull();
  });

  it("auto-stops after repeated consecutive read failures", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    for (let i = 0; i < 5; i++) {
      await settle(() => pending[i].reject(new Error("device not open")));
      if (i < 4) await advance(1000);
    }

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBe("device not open");
    expect(vi.getTimerCount()).toBe(0);
    expect(read).toHaveBeenCalledTimes(5);
  });

  it("a successful read resets the consecutive-failure count", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    for (let i = 0; i < 4; i++) {
      await settle(() => pending[i].reject(new Error("flaky")));
      await advance(1000);
    }
    await settle(() => pending[4].resolve(340));
    await advance(1000);
    await settle(() => pending[5].reject(new Error("flaky")));

    // 4 failures + success + 1 failure: the run survives.
    expect(result.current.isCapturing).toBe(true);
  });

  it("stops the loop on unmount", async () => {
    const { read } = deferredRead();
    const { result, unmount } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarting begins a fresh capture", async () => {
    const { read, pending } = deferredRead();
    const { result } = renderHook(() => useLiveCapture({ read, intervalMs: 1000 }));

    await settle(() => result.current.start());
    await settle(() => pending[0].resolve(340));
    await settle(() => result.current.stop());

    await settle(() => result.current.start());
    expect(result.current.points).toEqual([]);
    expect(result.current.sampleCount).toBe(0);

    await settle(() => pending[1].resolve(350));
    expect(result.current.points.map((p) => p.value)).toEqual([350]);
    expect(result.current.sampleCount).toBe(1);
  });
});
