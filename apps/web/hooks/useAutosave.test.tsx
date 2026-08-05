import { act, renderHook } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutosaveValidationError, useAutosave } from "./useAutosave";

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

  it("serializes saves and applies success effects only for the winning snapshot", async () => {
    let resolveFirst: (() => void) | null = null;
    const save = vi
      .fn<(v: string) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({ value, toKey: (v) => v, save, onSaved, delayMs: 20 }),
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
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("v1");
    expect(onSaved).not.toHaveBeenCalled();

    // The second request cannot start until the first has settled.
    await act(async () => {
      resolveFirst?.();
      await Promise.resolve();
    });
    await flushMicrotasks();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("v2");
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith("v2");
    expect(result.current.status).toBe("idle");
  });

  it("keeps an edit queued when it arrives during an awaited success effect", async () => {
    let resolveFirstEffect: (() => void) | null = null;
    const save = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi
      .fn<(value: string) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstEffect = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({ value, toKey: (v) => v, save, onSaved, delayMs: 20 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(save).toHaveBeenCalledWith("v1");
    expect(onSaved).toHaveBeenCalledWith("v1");
    expect(result.current.isSaving).toBe(true);

    rerender({ value: "v2" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstEffect?.();
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("v2");
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenLastCalledWith("v2");
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

  it("surfaces an invalid draft instead of reporting it saved", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
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
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(AutosaveValidationError);

    rerender({ value: "abc" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(save).toHaveBeenCalledWith("abc");
    expect(result.current.status).toBe("idle");
  });

  it("keeps a failed success effect retryable through flush", async () => {
    const failure = new Error("pin failed");
    const save = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) =>
        useAutosave({ value, toKey: (v) => v, save, onSaved, delayMs: 20 }),
      { initialProps: { value: "v0" } },
    );

    rerender({ value: "v1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(failure);

    await act(async () => result.current.flush());
    expect(save).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("idle");
  });

  it("discards an in-flight completion after the persistence scope changes", async () => {
    let releaseOldSave: (() => void) | undefined;
    const save = vi
      .fn<(value: string) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseOldSave = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(
      ({ value, scopeKey }: { value: string; scopeKey: string }) =>
        useAutosave({ value, scopeKey, toKey: (v) => v, save, onSaved, delayMs: 20 }),
      { initialProps: { value: "a0", scopeKey: "workbook-a" } },
    );

    rerender({ value: "a1", scopeKey: "workbook-a" });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(save).toHaveBeenCalledWith("a1");

    rerender({ value: "b0", scopeKey: "workbook-b" });
    await act(async () => {
      releaseOldSave?.();
      await Promise.resolve();
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");

    rerender({ value: "b1", scopeKey: "workbook-b" });
    await act(async () => vi.advanceTimersByTimeAsync(30));
    expect(save).toHaveBeenLastCalledWith("b1");
    expect(onSaved).toHaveBeenCalledWith("b1");
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
