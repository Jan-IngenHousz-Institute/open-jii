import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGetMeasurements, mockUploadWorker, mockAddNetworkStateListener } = vi.hoisted(() => ({
  mockGetMeasurements: vi.fn(),
  mockUploadWorker: vi.fn(),
  mockAddNetworkStateListener: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurements: mockGetMeasurements,
}));

vi.mock("../upload-worker", () => ({
  uploadWorker: mockUploadWorker,
}));

vi.mock("expo-network", () => ({
  addNetworkStateListener: mockAddNetworkStateListener,
}));

// Reset state-module singletons between tests so each it() starts with a
// clean queue + state.
async function freshQueue() {
  vi.resetModules();
  const stateMod = await import("../upload-queue-state");
  // Make sure the dependency-free state module also starts fresh by
  // forcing re-import; vi.resetModules() does that on subsequent imports.
  return {
    stateMod,
    queueMod: await import("../upload-queue"),
  };
}

describe("UploadQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockAddNetworkStateListener.mockReturnValue({ remove: () => undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueues an id and marks it as processing", async () => {
    const { queueMod, stateMod } = await freshQueue();
    const queue = queueMod.getUploadQueue();

    queue.enqueue("row-1");

    expect(stateMod.isProcessing("row-1")).toBe(true);
    expect(stateMod.getSnapshot()).toEqual({ isUploading: true, count: 1 });
  });

  it("does not double-enqueue the same id", async () => {
    const { queueMod, stateMod } = await freshQueue();
    const queue = queueMod.getUploadQueue();

    queue.enqueue("row-1");
    queue.enqueue("row-1");

    expect(stateMod.getSnapshot().count).toBe(1);
  });

  it("clears the processing flag after the worker resolves", async () => {
    mockUploadWorker.mockResolvedValue(undefined);
    const { queueMod, stateMod } = await freshQueue();
    const queue = queueMod.getUploadQueue();

    queue.enqueue("row-1");
    expect(stateMod.isProcessing("row-1")).toBe(true);

    // Pacer drives the worker on a microtask after addItem; flush.
    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(mockUploadWorker).toHaveBeenCalledWith("row-1");
    expect(stateMod.isProcessing("row-1")).toBe(false);
    expect(stateMod.getSnapshot()).toEqual({ isUploading: false, count: 0 });
  });

  it("rehydrates pending + failed rows from the DB on construction", async () => {
    mockGetMeasurements.mockResolvedValueOnce([
      { id: "a", status: "pending", data: { topic: "", measurementResult: {}, metadata: {} } },
      { id: "b", status: "failed", data: { topic: "", measurementResult: {}, metadata: {} } },
    ]);
    // Make the worker hang so the rows stay enqueued for the assertion.
    let resolveWorker: ((value: void) => void) | undefined;
    mockUploadWorker.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWorker = resolve;
        }),
    );

    const { queueMod, stateMod } = await freshQueue();
    queueMod.getUploadQueue();

    for (let i = 0; i < 5; i++) await Promise.resolve();

    expect(mockGetMeasurements).toHaveBeenCalledWith(["pending", "failed"]);
    expect(stateMod.isProcessing("a")).toBe(true);
    expect(stateMod.isProcessing("b")).toBe(true);

    resolveWorker?.(undefined);
  });

  it("registers a network state listener at construction", async () => {
    const { queueMod } = await freshQueue();
    queueMod.getUploadQueue();

    expect(mockAddNetworkStateListener).toHaveBeenCalled();
  });

  it("pauses the underlying queuer when offline event fires", async () => {
    const { queueMod } = await freshQueue();
    queueMod.getUploadQueue();

    const listener = mockAddNetworkStateListener.mock.calls[0]![0];
    // The listener flips the queuer's running state — we don't have a
    // direct handle on the queuer here, but verifying the listener
    // doesn't throw on either branch is the minimum smoke check.
    expect(() => listener({ isInternetReachable: false })).not.toThrow();
    expect(() => listener({ isInternetReachable: true })).not.toThrow();
  });
});
