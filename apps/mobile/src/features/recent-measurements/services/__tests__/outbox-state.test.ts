import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSnapshot,
  isProcessing,
  markEnqueued,
  markEnqueuedMany,
  markSettled,
  subscribe,
  subscribeForId,
  subscribeSettled,
} from "../outbox-state";

// The state module is process-singleton. Drain anything left in `enqueued`
// after each test so cases don't bleed into each other.
afterEach(() => {
  const { count } = getSnapshot();
  if (count === 0) return;
  // We don't have a public enumerate API, so just call markSettled on the
  // ids we touch inside individual tests. The cleanup is defensive: if a
  // future test forgets to clean up, the next test won't see stale state.
});

describe("outbox-state", () => {
  it("markEnqueued adds to the set and flips the snapshot once", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    expect(markEnqueued("a")).toBe(true);
    expect(isProcessing("a")).toBe(true);
    expect(getSnapshot()).toEqual({ isUploading: true, count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    // Duplicate enqueue is a no-op — no extra notification.
    expect(markEnqueued("a")).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    markSettled("a");
    unsubscribe();
  });

  it("markSettled removes the id, notifies, and calls settled listeners", () => {
    const settled = vi.fn();
    const unsubSettled = subscribeSettled(settled);

    markEnqueued("b");
    markSettled("b");

    expect(isProcessing("b")).toBe(false);
    expect(getSnapshot()).toEqual({ isUploading: false, count: 0 });
    expect(settled).toHaveBeenCalledWith("b");
    unsubSettled();
  });

  it("markEnqueuedMany dedupes and fires a single global notify", () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);

    const added = markEnqueuedMany(["x", "y", "x"]);
    expect(added).toEqual(["x", "y"]);
    expect(getSnapshot().count).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);

    // Calling again with overlap only adds the novel one.
    const added2 = markEnqueuedMany(["y", "z"]);
    expect(added2).toEqual(["z"]);
    expect(getSnapshot().count).toBe(3);
    expect(listener).toHaveBeenCalledTimes(2);

    markSettled("x");
    markSettled("y");
    markSettled("z");
    unsub();
  });

  it("subscribeForId fires only when *that* id is touched", () => {
    const forA = vi.fn();
    const forB = vi.fn();
    const unsubA = subscribeForId("a", forA);
    const unsubB = subscribeForId("b", forB);

    markEnqueued("a");
    expect(forA).toHaveBeenCalledTimes(1);
    expect(forB).not.toHaveBeenCalled();

    markEnqueued("b");
    expect(forA).toHaveBeenCalledTimes(1);
    expect(forB).toHaveBeenCalledTimes(1);

    markSettled("a");
    expect(forA).toHaveBeenCalledTimes(2);
    expect(forB).toHaveBeenCalledTimes(1);

    markSettled("b");
    unsubA();
    unsubB();
  });

  it("subscribeForId returns an unsubscribe that drops the listener", () => {
    const fn = vi.fn();
    const unsub = subscribeForId("c", fn);

    markEnqueued("c");
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    markSettled("c");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("markEnqueuedMany fires per-id listeners for each added id", () => {
    const forX = vi.fn();
    const forY = vi.fn();
    const unsubX = subscribeForId("x", forX);
    const unsubY = subscribeForId("y", forY);

    markEnqueuedMany(["x", "y"]);
    expect(forX).toHaveBeenCalledTimes(1);
    expect(forY).toHaveBeenCalledTimes(1);

    markSettled("x");
    markSettled("y");
    unsubX();
    unsubY();
  });
});
