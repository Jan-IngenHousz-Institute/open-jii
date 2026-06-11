import { act, renderHook } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutosave } from "./useAutosave";

// Drain microtasks (Promise.resolve callbacks) without advancing fake timers.
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire on mount with the initial value", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutosave({ value: "v0", toKey: (v) => v, save, delayMs: 100 }),
    );

    expect(result.current.status).toBe("idle");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("debounces value changes into a single save with the latest snapshot", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 50 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    rerender({ value: "v2" });
    expect(result.current.status).toBe("dirty");
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("v2");
    expect(result.current.status).toBe("idle");
  });

  it("transitions through dirty → saving → idle on the happy path", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolveSave = r;
        }),
    );
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 50 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(result.current.isSaving).toBe(true);

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(result.current.status).toBe("idle");
  });

  it("flips to error and surfaces the thrown value", async () => {
    const failure = new Error("boom");
    const save = vi.fn().mockRejectedValue(failure);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 50 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    await flushMicrotasks();

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toBe(failure);
  });

  it("clears error on a subsequent successful save", async () => {
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 50 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    await flushMicrotasks();
    expect(result.current.hasError).toBe(true);

    rerender({ value: "v2" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    await flushMicrotasks();

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBe(null);
  });

  it("returns to idle when the value is reverted before the save fires", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 50 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    expect(result.current.isDirty).toBe(true);
    rerender({ value: "v0" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await flushMicrotasks();

    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("ignores a stale save's resolution when a newer save already won", async () => {
    let resolveFirst: (() => void) | null = null;
    let resolveSecond: (() => void) | null = null;
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            resolveFirst = r;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            resolveSecond = r;
          }),
      );
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 20 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(result.current.isSaving).toBe(true);

    rerender({ value: "v2" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });

    // Newer save resolves first.
    await act(async () => {
      resolveSecond?.();
      await Promise.resolve();
    });
    await flushMicrotasks();
    expect(result.current.status).toBe("idle");

    // Older save resolves late — must NOT flip the state.
    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    await flushMicrotasks();
    expect(result.current.status).toBe("idle");
  });

  it("does nothing when disabled, then arms on enable without firing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value, enabled }: { value: string; enabled: boolean }) =>
        useAutosave({ value, toKey: (v) => v, save, delayMs: 50, enabled }),
      { initialProps: { value: "v0", enabled: false } },
    );

    rerender({ value: "v1", enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).not.toHaveBeenCalled();

    // Enable: rebase the saved anchor to current value, no spurious save.
    rerender({ value: "v1", enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");

    // Now an edit fires.
    rerender({ value: "v2", enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("v2");
  });

  it("respects isValid to gate save firing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({
          value,
          toKey: (v) => v,
          save,
          delayMs: 50,
          isValid: (v) => v.length >= 3,
        }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "ab" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).not.toHaveBeenCalled();

    rerender({ value: "abc" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).toHaveBeenCalledWith("abc");
  });

  it("flush() fires the pending save and resolves once it settles", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({ value, toKey: (v) => v, save, delayMs: 5_000 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush();
    });

    expect(save).toHaveBeenCalledWith("v1");
    expect(result.current.status).toBe("idle");
  });

  it("flush() with no pending save still awaits an in-flight save", async () => {
    let resolveSave: (() => void) | null = null;
    const save = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolveSave = r;
        }),
    );
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useAutosave({ value, toKey: (v) => v, save, delayMs: 20 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(result.current.isSaving).toBe(true);

    let flushResolved = false;
    const flushPromise = act(async () => {
      await result.current.flush();
      flushResolved = true;
    });
    await flushMicrotasks();
    expect(flushResolved).toBe(false);

    await act(async () => {
      resolveSave?.();
      await Promise.resolve();
    });
    await flushPromise;
    expect(flushResolved).toBe(true);
  });

  it("fires a pending save on unmount when flushOnUnmount is true (default)", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({ value, toKey: (v) => v, save, delayMs: 5_000 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    unmount();
    expect(save).toHaveBeenCalledWith("v1");
  });

  it("skips the unmount flush when flushOnUnmount is false", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({
          value,
          toKey: (v) => v,
          save,
          delayMs: 5_000,
          flushOnUnmount: false,
        }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    unmount();
    expect(save).not.toHaveBeenCalled();
  });

  it("memoizes toKey across renders that don't change value identity", () => {
    const toKey = vi.fn((v: { id: string }) => v.id);
    const save = vi.fn().mockResolvedValue(undefined);
    const stable = { id: "v0" };
    const { rerender } = renderHook(
      ({ value }: { value: { id: string } }) => useAutosave({ value, toKey, save, delayMs: 50 }),
      { initialProps: { value: stable } },
    );

    rerender({ value: stable });
    rerender({ value: stable });
    expect(toKey).toHaveBeenCalledTimes(1);
  });
});
