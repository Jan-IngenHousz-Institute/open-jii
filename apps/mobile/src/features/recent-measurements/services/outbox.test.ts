import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Transport } from "~/features/connection/services/mqtt/mqtt-transport";

const {
  mockGetMeasurementById,
  mockGetMeasurements,
  mockMarkAsSuccessful,
  mockMarkAsFailed,
  mockOnlineIsOnline,
  mockOnlineSubscribe,
  mockOnAppForeground,
} = vi.hoisted(() => ({
  mockGetMeasurementById: vi.fn(),
  mockGetMeasurements: vi.fn(),
  mockMarkAsSuccessful: vi.fn(),
  mockMarkAsFailed: vi.fn(),
  mockOnlineIsOnline: vi.fn(() => true),
  mockOnlineSubscribe: vi.fn((_cb: (online: boolean) => void) => () => undefined),
  mockOnAppForeground: vi.fn(),
}));

vi.mock("~/shared/db/measurements-storage", () => ({
  getMeasurementById: mockGetMeasurementById,
  getMeasurements: mockGetMeasurements,
  markAsSuccessful: mockMarkAsSuccessful,
  markAsFailed: mockMarkAsFailed,
  UNSYNCED_STATUSES: ["pending", "failed"],
}));

vi.mock("@tanstack/react-query", () => ({
  onlineManager: { isOnline: mockOnlineIsOnline, subscribe: mockOnlineSubscribe },
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

// Fresh module graph per test - the Outbox carries module-level state we
// don't want bleeding across cases. Re-importing MqttError from the same
// fresh realm is *load-bearing*: the Outbox uses `instanceof MqttError`
// for retry classification, and a class from a stale realm would never
// match - silently flipping terminal errors into retryable ones.
async function freshOutbox(
  transport: Transport,
  opts?: {
    concurrency?: number;
    retryBackoffMs?: readonly number[];
    largeTransport?: Transport;
  },
) {
  vi.resetModules();
  const outboxMod = await import("~/features/recent-measurements/services/outbox");
  const errorsMod = await import("~/features/connection/services/mqtt/mqtt-errors");
  const largeErrorsMod = await import(
    "~/features/recent-measurements/services/large-upload-errors"
  );
  const outbox = outboxMod.createOutbox({
    transport,
    largeTransport: opts?.largeTransport ?? makeTransport(),
    concurrency: opts?.concurrency ?? 1,
    retryBackoffMs: opts?.retryBackoffMs ?? [],
  });
  return {
    outbox,
    MqttError: errorsMod.MqttError,
    LargeUploadError: largeErrorsMod.LargeUploadError,
  };
}

function makeTransport(): Transport & {
  calls: { topic: string; payload: any }[];
  resolveNext: () => void;
  rejectNext: (err: Error) => void;
} {
  const calls: { topic: string; payload: any }[] = [];
  // FIFO queues so concurrent publish() calls all keep their own
  // resolver - the previous single-slot field silently dropped the first
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

// The worker yields to the event loop before measuring the payload, so a
// microtask-only pump would never reach the publish. Each round drains the
// microtask queue and then lets one macrotask through.
// Drains microtasks and lets one macrotask through per round, until the
// condition holds or the bound is reached.
async function waitUntil(done: () => boolean, rounds = 20) {
  for (let i = 0; i < rounds && !done(); i++) {
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function flushTasks(n = 8) {
  for (let i = 0; i < n; i++) {
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
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
    mockOnlineIsOnline.mockReturnValue(true);
    mockOnlineSubscribe.mockReturnValue(() => undefined);
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
      await flushTasks();

      expect(mockGetMeasurements).toHaveBeenCalledWith(["pending", "failed"]);
      expect(outbox.isProcessing("a")).toBe(true);
      expect(outbox.isProcessing("b")).toBe(true);
    });

    it("registers a network state listener and a foreground listener", async () => {
      const transport = makeTransport();
      await freshOutbox(transport);
      await flushTasks();

      expect(mockOnlineSubscribe).toHaveBeenCalledTimes(1);
      expect(mockOnAppForeground).toHaveBeenCalledTimes(1);
    });
  });

  describe("worker - happy path", () => {
    it("publishes the row payload with _client_id and marks the row successful", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(
        row({
          id: "row-1",
          topic: "exp/p",
          result: { v: 42, device_family: "multispeq", device_firmware: "2.311" },
        }),
      );
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      expect(outbox.isProcessing("row-1")).toBe(true);

      // Wait for the worker to call transport.publish.
      await waitUntil(() => transport.calls.length > 0, 20);
      expect(transport.calls).toHaveLength(1);
      expect(transport.calls[0].topic).toBe("exp/p");
      expect(transport.calls[0].payload).toEqual({
        v: 42,
        device_family: "multispeq",
        device_firmware: "2.311",
        _client_id: "row-1",
      });

      transport.resolveNext();
      await flushTasks(20);

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(outbox.isProcessing("row-1")).toBe(false);
    });

    it("keeps a delivered upload 'successful' even if the DB status write throws", async () => {
      // PUBACK arrives, then markAsSuccessful throws (e.g. SQLite busy). The
      // worker must NOT mark the row failed - the message was delivered - and
      // must still emit a 'successful' settle.
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "db-1" }));
      mockMarkAsSuccessful.mockRejectedValueOnce(new Error("sqlite busy"));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("db-1");
      await waitUntil(() => transport.calls.length > 0, 20);
      transport.resolveNext();
      await flushTasks(40);

      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([{ id: "db-1", status: "successful" }]);
      expect(outbox.isProcessing("db-1")).toBe(false);
    });
  });

  describe("worker - skip paths", () => {
    it("skips when the row is missing (e.g. deleted mid-flight)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(null);
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("ghost");
      await flushTasks(20);

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
      await flushTasks(20);

      expect(transport.calls).toHaveLength(0);
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
    });
  });

  describe("worker - error classification", () => {
    it("marks the row failed when the transport rejects with a terminal MqttError", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "row-1" }));
      const transport = makeTransport();
      const { outbox, MqttError } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      await waitUntil(() => transport.calls.length > 0, 20);
      transport.rejectNext(new MqttError("CredentialError", "no creds"));
      await flushTasks(40);

      expect(mockMarkAsFailed).toHaveBeenCalledWith("row-1", "CredentialError");
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
    });

    it("retries (does NOT mark failed) when the transport rejects with a retryable kind", async () => {
      // Two consecutive Disconnected rejections - the second succeeds.
      mockGetMeasurementById.mockResolvedValue(row({ id: "row-1" }));
      const transport = makeTransport();
      // One backoff step so AsyncRetryer will try a second time. Empty
      // baseWait would let the retryer drop the item.
      const { outbox, MqttError } = await freshOutbox(transport, { retryBackoffMs: [0] });

      outbox.enqueue("row-1");
      await waitUntil(() => transport.calls.length > 0, 20);
      transport.rejectNext(new MqttError("Disconnected", "kicked"));
      await flushTasks(40);

      // A retry happened - second publish call landed.
      await waitUntil(() => transport.calls.length >= 2, 30);
      expect(transport.calls.length).toBe(2);
      transport.resolveNext();
      await flushTasks(40);

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
      await waitUntil(() => transport.calls.length > 0, 20);
      transport.rejectNext(new MqttError("Disconnected", "kicked-1"));
      await flushTasks(40);

      // Retry fired - second (final) attempt publishes, then also rejects.
      await waitUntil(() => transport.calls.length >= 2, 30);
      expect(transport.calls.length).toBe(2);
      transport.rejectNext(new MqttError("Disconnected", "kicked-2"));
      await flushTasks(40);

      expect(mockMarkAsFailed).toHaveBeenCalledWith("ex-1", "Disconnected");
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([
        { id: "ex-1", status: "failed", reason: "Disconnected" },
      ]);
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
      await flushTasks(10);

      // markEnqueued is the state source of truth - a duplicate enqueue
      // bails before adding to the underlying queue.
      expect(outbox.isProcessing("row-1")).toBe(true);
    });

    it("enqueueMany adds only the novel ids", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      outbox.enqueue("a");
      outbox.enqueueMany(["a", "b", "c"]);
      await flushTasks(10);

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
      await flushTasks(4);
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
      await flushTasks();

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
      await flushTasks(40);

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
      await flushTasks();
      const cold = mockGetMeasurements.mock.calls.length;

      // Foregrounded immediately after cold start - well inside the
      // REHYDRATE_COOLDOWN_MS window (10s). The second call should be
      // skipped entirely.
      assertDefined<() => void>(foregroundCb, "foreground callback")();
      await flushTasks(10);

      expect(mockGetMeasurements).toHaveBeenCalledTimes(cold);
    });

    it("swallows rehydrate failures so the outbox stays usable", async () => {
      // Cold rehydrate throws; the constructor must not crash, and the
      // outbox must remain able to enqueue fresh work.
      mockGetMeasurements.mockRejectedValueOnce(new Error("sqlite locked"));
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "after-fail" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks(20);

      outbox.enqueue("after-fail");
      await waitUntil(() => transport.calls.length > 0, 20);
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushTasks(20);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("after-fail");
    });
  });

  describe("network listener", () => {
    it("pauses the queue when offline and resumes on reconnect", async () => {
      let onlineCb: ((online: boolean) => void) | null = null;
      mockOnlineSubscribe.mockImplementation((cb: (online: boolean) => void) => {
        onlineCb = cb;
        return () => undefined;
      });

      mockGetMeasurementById.mockResolvedValue(row({ id: "net-a" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks();
      expect(onlineCb).not.toBeNull();

      // Offline: the queue is stopped, so the worker does not pick up the item.
      assertDefined<(online: boolean) => void>(onlineCb, "online callback")(false);
      outbox.enqueue("net-a");
      await flushTasks(10);
      expect(transport.calls).toHaveLength(0);

      // Back online: the queue drains and the worker publishes.
      assertDefined<(online: boolean) => void>(onlineCb, "online callback")(true);
      await waitUntil(() => transport.calls.length > 0, 30);
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushTasks(20);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("net-a");
    });

    it("starts paused while offline at construction (no upload until online)", async () => {
      mockOnlineIsOnline.mockReturnValue(false);
      let onlineCb: ((online: boolean) => void) | null = null;
      mockOnlineSubscribe.mockImplementation((cb: (online: boolean) => void) => {
        onlineCb = cb;
        return () => undefined;
      });

      mockGetMeasurementById.mockResolvedValue(row({ id: "net-b" }));
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks();

      outbox.enqueue("net-b");
      await flushTasks(10);
      expect(transport.calls).toHaveLength(0);

      assertDefined<(online: boolean) => void>(onlineCb, "online callback")(true);
      await waitUntil(() => transport.calls.length > 0, 30);
      expect(transport.calls).toHaveLength(1);
      transport.resolveNext();
      await flushTasks(20);
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
      await flushTasks(4);

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
      await flushTasks(4);

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
      await flushTasks(4);
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
      await waitUntil(() => transport.calls.length >= 2, 30);
      expect(transport.calls).toHaveLength(2);

      // Resolve both publishes in the same turn.
      transport.resolveNext();
      transport.resolveNext();
      await flushTasks(40);

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
      await waitUntil(() => transport.calls.length > 0, 20);
      transport.rejectNext(new MqttError("CredentialError", "no creds"));
      await flushTasks(40);

      expect(settled).toHaveBeenCalledTimes(1);
      expect(settled.mock.calls[0][0]).toEqual([
        { id: "f1", status: "failed", reason: "CredentialError" },
      ]);
    });

    it("subscribeSettled emits nothing for skip paths (row gone / already successful)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(null);
      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);

      const settled = vi.fn();
      outbox.subscribeSettled(settled);

      outbox.enqueue("ghost");
      await flushTasks(40);

      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("detaches the network + foreground listeners", async () => {
      const removeNetwork = vi.fn();
      const removeForeground = vi.fn();
      mockOnlineSubscribe.mockReturnValue(removeNetwork);
      mockOnAppForeground.mockReturnValue(removeForeground);

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks();

      outbox.destroy();

      expect(removeNetwork).toHaveBeenCalledTimes(1);
      expect(removeForeground).toHaveBeenCalledTimes(1);
    });

    it("goes inert: enqueue after destroy never publishes", async () => {
      mockOnAppForeground.mockReturnValue(() => undefined);
      mockGetMeasurementById.mockResolvedValue(row({ id: "late" }));

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks();

      outbox.destroy();
      outbox.enqueue("late");
      await flushTasks(20);

      expect(outbox.isProcessing("late")).toBe(false);
      expect(transport.calls).toHaveLength(0);
    });

    it("is idempotent", async () => {
      const removeNetwork = vi.fn();
      mockOnlineSubscribe.mockReturnValue(removeNetwork);
      mockOnAppForeground.mockReturnValue(() => undefined);

      const transport = makeTransport();
      const { outbox } = await freshOutbox(transport);
      await flushTasks();

      outbox.destroy();
      outbox.destroy();

      expect(removeNetwork).toHaveBeenCalledTimes(1);
    });
  });

  describe("transport routing by payload size", () => {
    // `{"blob":"<n>","_client_id":"row-1"}` is the serialized payload, and the
    // literal characters around the blob account for the difference.
    const ENVELOPE_CHARS = 32;
    const LIMIT = 128 * 1024;

    async function runOne(result: object) {
      const mqtt = makeTransport();
      const large = makeTransport();
      mockGetMeasurementById.mockResolvedValue(row({ result }));
      const { outbox } = await freshOutbox(mqtt, { largeTransport: large });
      await flushTasks();

      outbox.enqueue("row-1");
      await flushTasks(20);
      mqtt.resolveNext();
      large.resolveNext();
      await flushTasks(20);

      return { mqtt, large };
    }

    it("publishes over MQTT at exactly the broker limit", async () => {
      const { mqtt, large } = await runOne({ blob: "x".repeat(LIMIT - ENVELOPE_CHARS) });

      expect(mqtt.calls).toHaveLength(1);
      expect(large.calls).toHaveLength(0);
    });

    it("routes to the large transport one byte past the limit", async () => {
      const { mqtt, large } = await runOne({ blob: "x".repeat(LIMIT - ENVELOPE_CHARS + 1) });

      expect(mqtt.calls).toHaveLength(0);
      expect(large.calls).toHaveLength(1);
    });

    it("counts UTF-8 bytes, not characters", async () => {
      // Every one of these is three bytes, so the payload is under the limit in
      // characters and over it in bytes.
      const chars = Math.ceil((LIMIT - ENVELOPE_CHARS) / 3) + 1;
      const { mqtt, large } = await runOne({ blob: "\u4e2d".repeat(chars) });

      expect(chars).toBeLessThan(LIMIT - ENVELOPE_CHARS);
      expect(mqtt.calls).toHaveLength(0);
      expect(large.calls).toHaveLength(1);
    });

    it("marks a row failed without retrying when the large transport is terminal", async () => {
      const mqtt = makeTransport();
      const large = makeTransport();
      mockGetMeasurementById.mockResolvedValue(row({ result: { blob: "x".repeat(LIMIT) } }));
      const { outbox, LargeUploadError } = await freshOutbox(mqtt, {
        largeTransport: large,
        retryBackoffMs: [0, 0],
      });
      await flushTasks();

      outbox.enqueue("row-1");
      await waitUntil(() => large.calls.length > 0, 30);
      large.rejectNext(new LargeUploadError("Forbidden", "not a contributor", false));
      await flushTasks(40);

      expect(large.calls).toHaveLength(1);
      expect(mockMarkAsFailed).toHaveBeenCalledWith("row-1", "Forbidden");
      expect(mqtt.calls).toHaveLength(0);
    });

    it("retries a large upload the transport says is worth repeating", async () => {
      const mqtt = makeTransport();
      const large = makeTransport();
      mockGetMeasurementById.mockResolvedValue(row({ result: { blob: "x".repeat(LIMIT) } }));
      const { outbox, LargeUploadError } = await freshOutbox(mqtt, {
        largeTransport: large,
        retryBackoffMs: [0],
      });
      await flushTasks();

      outbox.enqueue("row-1");
      await waitUntil(() => large.calls.length > 0, 30);
      large.rejectNext(new LargeUploadError("Network", "socket hang up", true));
      await flushTasks(40);

      await waitUntil(() => large.calls.length >= 2, 40);
      expect(large.calls).toHaveLength(2);
    });

    it("marks the row successful when the large transport accepts it", async () => {
      const { large } = await runOne({ blob: "x".repeat(LIMIT) });

      expect(large.calls).toHaveLength(1);
      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
    });
  });
});
