import { describe, it, expect, vi, beforeEach } from "vitest";

// Each test gets a clean module instance so the module-level Sets
// (`enqueued`, `listeners`, `settledListeners`) start empty. Mirrors the
// pattern used by upload-queue.test.ts.
async function freshState() {
  vi.resetModules();
  return await import("../upload-queue-state");
}

describe("upload-queue-state — subscribeSettled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires the settled listener with the id when an enqueued item is settled", async () => {
    const state = await freshState();
    const listener = vi.fn();
    state.subscribeSettled(listener);

    state.markEnqueued("row-1");
    expect(listener).not.toHaveBeenCalled();

    state.markSettled("row-1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("row-1");
  });

  it("does not fire when markSettled is called for an id that was never enqueued", async () => {
    const state = await freshState();
    const listener = vi.fn();
    state.subscribeSettled(listener);

    state.markSettled("ghost");
    expect(listener).not.toHaveBeenCalled();
  });

  it("invokes every subscribed listener on each settle", async () => {
    const state = await freshState();
    const a = vi.fn();
    const b = vi.fn();
    state.subscribeSettled(a);
    state.subscribeSettled(b);

    state.markEnqueued("row-1");
    state.markSettled("row-1");

    expect(a).toHaveBeenCalledWith("row-1");
    expect(b).toHaveBeenCalledWith("row-1");
  });

  it("stops invoking a listener after its unsubscribe is called", async () => {
    const state = await freshState();
    const listener = vi.fn();
    const unsubscribe = state.subscribeSettled(listener);

    state.markEnqueued("row-1");
    state.markSettled("row-1");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    state.markEnqueued("row-2");
    state.markSettled("row-2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("fans settled events per item, not just on full-drain", async () => {
    const state = await freshState();
    const listener = vi.fn();
    state.subscribeSettled(listener);

    state.markEnqueued("a");
    state.markEnqueued("b");
    state.markEnqueued("c");

    state.markSettled("a");
    state.markSettled("b");
    state.markSettled("c");

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
  });

  it("keeps the snapshot subscription independent from the settled subscription", async () => {
    const state = await freshState();
    const snapshot = vi.fn();
    const settled = vi.fn();
    state.subscribe(snapshot);
    state.subscribeSettled(settled);

    state.markEnqueued("row-1");
    // count: 0 → 1 → snapshot listener fires, settled listener silent.
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();

    state.markSettled("row-1");
    // count: 1 → 0 → snapshot listener fires AND settled listener fires.
    expect(snapshot).toHaveBeenCalledTimes(2);
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
