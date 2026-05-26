// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Outbox, OutboxSnapshot } from "../../services/outbox";

// Drive the hook with a hand-rolled fake Outbox so we can flip its
// snapshot / per-id state synchronously and observe React updates. This
// hits the exact subscribe/getSnapshot contract the hook depends on.
function makeFakeOutbox(): Outbox & {
  __enqueue(id: string): void;
  __settle(id: string): void;
} {
  const enqueued = new Set<string>();
  const idListeners = new Map<string, Set<() => void>>();
  const snapshotListeners = new Set<() => void>();
  let snapshot: OutboxSnapshot = { isUploading: false, count: 0 };

  function notifySnapshot() {
    const next = { isUploading: enqueued.size > 0, count: enqueued.size };
    if (next.isUploading === snapshot.isUploading && next.count === snapshot.count) return;
    snapshot = next;
    Array.from(snapshotListeners).forEach((l) => l());
  }
  function notifyId(id: string) {
    const set = idListeners.get(id);
    if (!set) return;
    Array.from(set).forEach((l) => l());
  }

  return {
    enqueue() {},
    enqueueMany() {},
    destroy() {},
    isProcessing: (id: string) => enqueued.has(id),
    subscribeProcessing(id, listener) {
      let set = idListeners.get(id);
      if (!set) {
        set = new Set();
        idListeners.set(id, set);
      }
      set.add(listener);
      return () => set!.delete(listener);
    },
    subscribeSettled() {
      return () => undefined;
    },
    getSnapshot: () => snapshot,
    subscribeSnapshot(listener) {
      snapshotListeners.add(listener);
      return () => snapshotListeners.delete(listener);
    },
    __enqueue(id: string) {
      if (enqueued.has(id)) return;
      enqueued.add(id);
      notifySnapshot();
      notifyId(id);
    },
    __settle(id: string) {
      if (!enqueued.delete(id)) return;
      notifySnapshot();
      notifyId(id);
    },
  };
}

const { fake, getOutboxMock } = vi.hoisted(() => {
  const fake = { current: null as null | ReturnType<typeof makeFakeOutbox> };
  return {
    fake,
    getOutboxMock: vi.fn(() => fake.current!),
  };
});

vi.mock("~/shared/composition/upload", () => ({
  getOutbox: getOutboxMock,
}));

// Static import — vi.hoisted lifts the mock above this import.
import { useIsProcessing, useOutboxSnapshot } from "../use-outbox-state";

beforeEach(() => {
  fake.current = makeFakeOutbox();
});

describe("useOutboxSnapshot", () => {
  it("starts with isUploading=false and count=0", () => {
    const { result } = renderHook(() => useOutboxSnapshot());
    expect(result.current.isUploading).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("flips to isUploading=true and count>=1 while an id is enqueued", () => {
    const { result } = renderHook(() => useOutboxSnapshot());
    act(() => fake.current!.__enqueue("snap-a"));
    expect(result.current.isUploading).toBe(true);
    expect(result.current.count).toBe(1);
  });

  it("returns to isUploading=false once every id is settled", () => {
    const { result } = renderHook(() => useOutboxSnapshot());
    act(() => {
      fake.current!.__enqueue("snap-b");
      fake.current!.__enqueue("snap-c");
    });
    expect(result.current.count).toBe(2);

    act(() => fake.current!.__settle("snap-b"));
    expect(result.current.count).toBe(1);

    act(() => fake.current!.__settle("snap-c"));
    expect(result.current.isUploading).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("returns a stable snapshot reference between equivalent updates", () => {
    const { result, rerender } = renderHook(() => useOutboxSnapshot());
    act(() => fake.current!.__enqueue("snap-d"));
    const a = result.current;
    rerender();
    const b = result.current;
    expect(a).toBe(b);
  });
});

describe("useIsProcessing", () => {
  it("returns true only for the subscribed id, not for other in-flight ids", () => {
    const { result: forX } = renderHook(() => useIsProcessing("ip-x"));
    const { result: forY } = renderHook(() => useIsProcessing("ip-y"));

    act(() => fake.current!.__enqueue("ip-x"));
    expect(forX.current).toBe(true);
    expect(forY.current).toBe(false);

    act(() => fake.current!.__enqueue("ip-y"));
    expect(forX.current).toBe(true);
    expect(forY.current).toBe(true);
  });

  it("flips back to false when the subscribed id settles", () => {
    const { result } = renderHook(() => useIsProcessing("ip-z"));
    act(() => fake.current!.__enqueue("ip-z"));
    expect(result.current).toBe(true);
    act(() => fake.current!.__settle("ip-z"));
    expect(result.current).toBe(false);
  });

  it("re-subscribes when the id prop changes", () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useIsProcessing(id), {
      initialProps: { id: "ip-a" },
    });
    act(() => fake.current!.__enqueue("ip-a"));
    expect(result.current).toBe(true);

    rerender({ id: "ip-b" });
    expect(result.current).toBe(false);

    act(() => fake.current!.__enqueue("ip-b"));
    expect(result.current).toBe(true);
  });
});
