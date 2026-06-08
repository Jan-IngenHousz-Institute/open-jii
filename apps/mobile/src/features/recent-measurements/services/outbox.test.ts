import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Transport } from "~/features/connection/services/mqtt/mqtt-transport";

const {
  mockGetMeasurementById,
  mockGetMeasurements,
  mockMarkAsSuccessful,
  mockMarkAsFailed,
  mockAddNetworkStateListener,
  mockOnAppForeground,
} = vi.hoisted(() => ({
  mockGetMeasurementById: vi.fn(),
  mockGetMeasurements: vi.fn(),
  mockMarkAsSuccessful: vi.fn(),
  mockMarkAsFailed: vi.fn(),
  mockAddNetworkStateListener: vi.fn(),
  mockOnAppForeground: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurementById: mockGetMeasurementById,
  getMeasurements: mockGetMeasurements,
  markAsSuccessful: mockMarkAsSuccessful,
  markAsFailed: mockMarkAsFailed,
}));

vi.mock("expo-network", () => ({
  addNetworkStateListener: mockAddNetworkStateListener,
}));

vi.mock("~/shared/device/app-lifecycle", () => ({
  onAppForeground: mockOnAppForeground,
}));

// trace utility: real module is fine but the no-op traces work everywhere.
// Stub to avoid any setup work in tests.
vi.mock("~/shared/observability/trace", () => ({
  startTrace: vi.fn(() => ({
    event: vi.fn(),
    setFields: vi.fn(),
    end: vi.fn(),
  })),
  getTrace: vi.fn(() => ({
    event: vi.fn(),
    setFields: vi.fn(),
    end: vi.fn(),
  })),
}));

// Fresh module graph per test — the Outbox carries module-level state we
// don't want bleeding across cases. Re-importing MqttError from the same
// fresh realm is *load-bearing*: the Outbox uses `instanceof MqttError`
// for retry classification, and a class from a stale realm would never
// match — silently flipping terminal errors into retryable ones.
async function freshOutbox(
  transport: Transport,
  opts?: { concurrency?: number; retryBackoffMs?: readonly number[] },
) {
  vi.resetModules();
  const outboxMod = await import("~/features/recent-measurements/services/outbox");
  const errorsMod = await import("~/features/connection/services/mqtt/mqtt-errors");
  const outbox = outboxMod.createOutbox({
    transport,
    concurrency: opts?.concurrency ?? 1,
    retryBackoffMs: opts?.retryBackoffMs ?? [],
  });
  return { outbox, MqttError: errorsMod.MqttError };
}

function makeTransport(): Transport & {
  calls: { topic: string; payload: any }[];
  resolveNext: () => void;
  rejectNext: (err: Error) => void;
} {
  const calls: { topic: string; payload: any }[] = [];
  // FIFO queues so concurrent publish() calls all keep their own
  // resolver — the previous single-slot field silently dropped the first
  // in-flight publish under concurrency > 1.
  const resolvers: (() => void)[] = [];
  const rejecters: ((err: Error) => void)[] = [];
  return {
    calls,
    publish(topic, payload) {
      calls.push({ topic, payload });
      return new Promise<void>((resolve, reject) => {
        resolvers.push(resolve);
        rejecters.push(reject);
      });
    },
    destroy: vi.fn(),
    resolveNext() {
      const resolve = resolvers.shift();
      rejecters.shift();
      resolve?.();
    },
    rejectNext(err: Error) {
      const reject = rejecters.shift();
      resolvers.shift();
      reject?.(err);
    },
  };
}

const row = (
  overrides: Partial<{
    id: string;
    status: "pending" | "failed" | "successful";
    topic: string;
    result: object;
  }> = {},
) => ({
  id: overrides.id ?? "row-1",
  status: overrides.status ?? "pending",
  data: {
    topic: overrides.topic ?? "exp/proto",
    measurementResult: overrides.result ?? { foo: 1 },
    metadata: { experimentName: "e", protocolName: "p", timestamp: "t" },
  },
});

async function flushMicrotasks(n = 8) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

// Narrowing helper: asserts a captured callback is present and returns it
// typed as non-nullable, avoiding non-null assertions in test bodies.
function assertDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

describe("Outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMeasurements.mockResolvedValue([]);
    mockAddNetworkStateListener.mockReturnValue({ remove: () => undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("construction", () => {
    it("rehydrates pending + failed rows from the DB", async () => {
      mockGetMeasurements.mockResolvedValueOnce([
        row({ id: "a", status: "pending" }),
        row({ id: "b", status: "failed" }),
      ]);
      mockGetMeasurementById.mockImplementation((id) =>
        Promise.resolve(row({ id, status: "pending" })),
      );

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      expect(mockGetMeasurements).toHaveBeenCalledWith(["pending", "failed"]);
      expect(outbox.isProcessing("a")).toBe(true);
      expect(outbox.isProcessing("b")).toBe(true);
    });

    it("registers a network state listener and a foreground listener", async () => {
      const transport = makeTransport();
      await freshOutbox(transport);
      await flushMicrotasks();

      expect(mockAddNetworkStateListener).toHaveBeenCalledTimes(1);
      expect(mockOnAppForeground).toHaveBeenCalledTimes(1);
    });
  });

  describe("worker — happy path", () => {
    it("publishes the row payload with _client_id and marks the row successful", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(
        row({ id: "row-1", topic: "exp/p", result: { v: 42 } }),
      );
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      expect(outbox.isProcessing("row-1")).toBe(true);

      // Wait for the worker to call transport.publish.
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(1);
      expect(transport.calls[0].topic).toBe("exp/p");
      expect(transport.calls[0].payload).toEqual({ v: 42, _client_id: "row-1" });

      transport.resolveNext();
      await flushMicrotasks(20);

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(outbox.isProcessing("row-1")).toBe(false);
    });

    it("keeps a delivered upload 'successful' even if the DB status write throws", async () => {
      // PUBACK arrives, then markAsSuccessful throws (e.g. SQLite busy). The
      // worker must NOT mark the row failed — the message was delivered — and
      // must still emit a 'successful' settle.
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "db-1" }));
      mockMarkAsSuccessful.mockRejectedValueOnce(new Error("sqlite busy"));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("db-1");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      transport.resolveNext();
      await flushMicrotasks(40);

      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([{ id: "db-1", status: "successful" }]);
      expect(outbox.isProcessing("db-1")).toBe(false);
    });
  });

  describe("worker — skip paths", () => {
    it("skips when the row is missing (e.g. deleted mid-flight)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(null);
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("ghost");
      await flushMicrotasks(20);

      expect(transport.calls).toHaveLength(0);
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(outbox.isProcessing("ghost")).toBe(false);
    });

    it("skips when the row is already successful (concurrent ack/rehydrate)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "row-1", status: "successful" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      await flushMicrotasks(20);

      expect(transport.calls).toHaveLength(0);
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
    });
  });

  describe("worker — error classification", () => {
    it("marks the row failed when the transport rejects with a terminal MqttError", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "row-1" }));
      const transport = makeTransport();
      const { outbox, MqttError } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      transport.rejectNext(new MqttError("CredentialError", "no creds"));
      await flushMicrotasks(40);

      expect(mockMarkAsFailed).toHaveBeenCalledWith("row-1");
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
    });

    it("retries (does NOT mark failed) when the transport rejects with a retryable kind", async () => {
      // Two consecutive Disconnected rejections — the second succeeds.
      mockGetMeasurementById.mockResolvedValue(row({ id: "row-1" }));
      const transport = makeTransport();
      // One backoff step so AsyncRetryer will try a second time. Empty
      // baseWait would let the retryer drop the item.
      const { outbox, MqttError } = await freshOutbox(transport, { retryBackoffMs: [0] });

      outbox.enqueue("row-1");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      transport.rejectNext(new MqttError("Disconnected", "kicked"));
      await flushMicrotasks(40);

      // A retry happened — second publish call landed.
      for (let i = 0; i < 30 && transport.calls.length < 2; i++) await Promise.resolve();
      expect(transport.calls.length).toBe(2);
      transport.resolveNext();
      await flushMicrotasks(40);

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
    });

    it("marks failed + emits a 'failed' settle when retryable errors exhaust", async () => {
      // One backoff step → maxAttempts = 2. Both attempts reject with a
      // retryable kind, so the AsyncRetryer exhausts and the error escapes to
      // the queue's onError, which must terminalize the otherwise-stuck row.
      mockGetMeasurementById.mockResolvedValue(row({ id: "ex-1" }));
      const transport = makeTransport();
      const { outbox, MqttError } = await freshOutbox(transport, { retryBackoffMs: [0] });

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("ex-1");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      transport.rejectNext(new MqttError("Disconnected", "kicked-1"));
      await flushMicrotasks(40);

      // Retry fired — second (final) attempt publishes, then also rejects.
      for (let i = 0; i < 30 && transport.calls.length < 2; i++) await Promise.resolve();
      expect(transport.calls.length).toBe(2);
      transport.rejectNext(new MqttError("Disconnected", "kicked-2"));
      await flushMicrotasks(40);

      expect(mockMarkAsFailed).toHaveBeenCalledWith("ex-1");
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([{ id: "ex-1", status: "failed" }]);
      expect(outbox.isProcessing("ex-1")).toBe(false);
    });
  });

  describe("enqueue / enqueueMany dedup", () => {
    it("enqueue dedupes ids already in flight", async () => {
      mockGetMeasurementById.mockImplementation(
        () => new Promise(() => undefined), // hang the worker
      );
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      outbox.enqueue("row-1");
      await flushMicrotasks(10);

      // markEnqueued is the state source of truth — a duplicate enqueue
      // bails before adding to the underlying queue.
      expect(outbox.isProcessing("row-1")).toBe(true);
    });

    it("enqueueMany adds only the novel ids", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("a");
      outbox.enqueueMany(["a", "b", "c"]);
      await flushMicrotasks(10);

      expect(outbox.isProcessing("a")).toBe(true);
      expect(outbox.isProcessing("b")).toBe(true);
      expect(outbox.isProcessing("c")).toBe(true);
    });

    it("isProcessing delegates to the shared state module", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      expect(outbox.isProcessing("unknown")).toBe(false);
      outbox.enqueue("known");
      await flushMicrotasks(4);
      expect(outbox.isProcessing("known")).toBe(true);
    });
  });

  describe("rehydrate", () => {
    it("re-enqueues every pending/failed row when the app foregrounds", async () => {
      // Capture the foreground callback so we can trigger it.
      let foregroundCb: (() => void) | null = null;
      mockOnAppForeground.mockImplementation((cb: () => void) => {
        foregroundCb = cb;
      });

      // First rehydrate (cold start): empty queue.
      mockGetMeasurements.mockResolvedValueOnce([]);
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      // Bypass the 10 s cooldown by advancing the clock.
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 20_000);

      // Second rehydrate (foreground): two rows waiting.
      mockGetMeasurements.mockResolvedValueOnce([
        row({ id: "fg-a", status: "pending" }),
        row({ id: "fg-b", status: "failed" }),
      ]);
      mockGetMeasurementById.mockImplementation((id) =>
        Promise.resolve(row({ id, status: "pending" })),
      );

      expect(foregroundCb).not.toBeNull();
      assertDefined<() => void>(foregroundCb, "foreground callback")();
      vi.useRealTimers();
      await flushMicrotasks(40);

      expect(mockGetMeasurements).toHaveBeenCalledTimes(2);
      expect(outbox.isProcessing("fg-a")).toBe(true);
      expect(outbox.isProcessing("fg-b")).toBe(true);
    });

    it("suppresses back-to-back rehydrates inside the cooldown window", async () => {
      let foregroundCb: (() => void) | null = null;
      mockOnAppForeground.mockImplementation((cb: () => void) => {
        foregroundCb = cb;
      });

      mockGetMeasurements.mockResolvedValue([]);
      const transport = makeTransport();
      await freshOutbox(transport);
      await flushMicrotasks();
      const cold = mockGetMeasurements.mock.calls.length;

      // Foregrounded immediately after cold start — well inside the
      // REHYDRATE_COOLDOWN_MS window (10s). The second call should be
      // skipped entirely.
      assertDefined<() => void>(foregroundCb, "foreground callback")();
      await flushMicrotasks(10);

      expect(mockGetMeasurements).toHaveBeenCalledTimes(cold);
    });

    it("swallows rehydrate failures so the outbox stays usable", async () => {
      // Cold rehydrate throws; the constructor must not crash, and the
      // outbox must remain able to enqueue fresh work.
      mockGetMeasurements.mockRejectedValueOnce(new Error("sqlite locked"));
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "after-fail" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks(20);

      outbox.enqueue("after-fail");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushMicrotasks(20);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("after-fail");
    });
  });

  describe("network listener", () => {
    it("pauses the queue when the network goes offline and resumes on reconnect", async () => {
      // Capture the network callback for direct invocation.
      let networkCb: ((state: { isInternetReachable: boolean | null | undefined }) => void) | null =
        null;
      mockAddNetworkStateListener.mockImplementation((cb: typeof networkCb) => {
        networkCb = cb;
        return { remove: () => undefined };
      });

      mockGetMeasurementById.mockResolvedValue(row({ id: "net-a" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();
      expect(networkCb).not.toBeNull();

      // Go offline before enqueueing — the queue is stopped, so the
      // worker should not pick up the item.
      assertDefined<(state: { isInternetReachable: boolean | null | undefined }) => void>(
        networkCb,
        "network callback",
      )({ isInternetReachable: false });
      outbox.enqueue("net-a");
      await flushMicrotasks(10);
      expect(transport.calls).toHaveLength(0);

      // Back online — queue starts draining and the worker publishes.
      assertDefined<(state: { isInternetReachable: boolean | null | undefined }) => void>(
        networkCb,
        "network callback",
      )({ isInternetReachable: true });
      for (let i = 0; i < 30 && transport.calls.length === 0; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushMicrotasks(20);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("net-a");
    });

    it("does not pause on undefined isInternetReachable (treat unknown as online)", async () => {
      // expo-network briefly emits undefined around state transitions; the
      // outbox must not treat that as offline (it'd stall the queue).
      let networkCb: ((state: { isInternetReachable: boolean | null | undefined }) => void) | null =
        null;
      mockAddNetworkStateListener.mockImplementation((cb: typeof networkCb) => {
        networkCb = cb;
        return { remove: () => undefined };
      });

      mockGetMeasurementById.mockResolvedValue(row({ id: "net-b" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      assertDefined<(state: { isInternetReachable: boolean | null | undefined }) => void>(
        networkCb,
        "network callback",
      )({ isInternetReachable: undefined });
      outbox.enqueue("net-b");
      for (let i = 0; i < 30 && transport.calls.length === 0; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushMicrotasks(20);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("net-b");
    });
  });

  describe("reactive surface", () => {
    it("subscribeProcessing wakes only listeners watching the matching id", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const aCb = vi.fn();
      const bCb = vi.fn();
      outbox.subscribeProcessing("a", aCb);
      outbox.subscribeProcessing("b", bCb);

      outbox.enqueue("a");
      await flushMicrotasks(4);

      expect(aCb).toHaveBeenCalledTimes(1);
      expect(bCb).not.toHaveBeenCalled();
    });

    it("subscribeProcessing returns an unsubscribe fn", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const cb = vi.fn();
      const unsubscribe = outbox.subscribeProcessing("x", cb);
      unsubscribe();
      outbox.enqueue("x");
      await flushMicrotasks(4);

      expect(cb).not.toHaveBeenCalled();
    });

    it("subscribeSnapshot fires with isUploading/count flips", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const cb = vi.fn();
      outbox.subscribeSnapshot(cb);

      expect(outbox.getSnapshot()).toEqual({ isUploading: false, count: 0 });
      outbox.enqueue("s1");
      await flushMicrotasks(4);
      expect(outbox.getSnapshot()).toEqual({ isUploading: true, count: 1 });
      expect(cb).toHaveBeenCalled();
    });

    it("subscribeSettled emits one batch carrying terminal status per microtask burst", async () => {
      // Two rows publish concurrently and both resolve in the same JS turn.
      // The Outbox batcher must collapse both PUBACKs into a single dispatch.
      const rows = new Map([
        ["b1", row({ id: "b1" })],
        ["b2", row({ id: "b2" })],
      ]);
      mockGetMeasurementById.mockImplementation((id) => Promise.resolve(rows.get(id)));

      const transport = makeTransport();
      // concurrency 2 so both items publish in parallel.
      const { outbox } = await freshOutbox(transport, { concurrency: 2 });

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueueMany(["b1", "b2"]);
      for (let i = 0; i < 30 && transport.calls.length < 2; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(2);

      // Resolve both publishes in the same turn.
      transport.resolveNext();
      transport.resolveNext();
      await flushMicrotasks(40);

      expect(settled).toHaveBeenCalledTimes(1);
      const items = settled.mock.calls[0][0] as readonly { id: string; status: string }[];
      expect(items.map((i) => i.id).sort()).toEqual(["b1", "b2"]);
      for (const item of items) expect(item.status).toBe("successful");
    });

    it("subscribeSettled carries 'failed' for terminal errors", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "f1" }));
      const transport = makeTransport();
      const { outbox, MqttError } = await freshOutbox(transport);

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("f1");
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      transport.rejectNext(new MqttError("CredentialError", "no creds"));
      await flushMicrotasks(40);

      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([{ id: "f1", status: "failed" }]);
    });

    it("subscribeSettled emits nothing for skip paths (row gone / already successful)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(null);
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("ghost");
      await flushMicrotasks(40);

      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("detaches the network + foreground listeners", async () => {
      const removeNetwork = vi.fn();
      const removeForeground = vi.fn();
      mockAddNetworkStateListener.mockReturnValue({ remove: removeNetwork });
      mockOnAppForeground.mockReturnValue(removeForeground);

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      outbox.destroy();

      expect(removeNetwork).toHaveBeenCalledTimes(1);
      expect(removeForeground).toHaveBeenCalledTimes(1);
    });

    it("goes inert: enqueue after destroy never publishes", async () => {
      mockOnAppForeground.mockReturnValue(() => undefined);
      mockGetMeasurementById.mockResolvedValue(row({ id: "late" }));

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      outbox.destroy();
      outbox.enqueue("late");
      await flushMicrotasks(20);

      expect(outbox.isProcessing("late")).toBe(false);
      expect(transport.calls).toHaveLength(0);
    });

    it("is idempotent", async () => {
      const removeNetwork = vi.fn();
      mockAddNetworkStateListener.mockReturnValue({ remove: removeNetwork });
      mockOnAppForeground.mockReturnValue(() => undefined);

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushMicrotasks();

      outbox.destroy();
      outbox.destroy();

      expect(removeNetwork).toHaveBeenCalledTimes(1);
    });
  });
});
