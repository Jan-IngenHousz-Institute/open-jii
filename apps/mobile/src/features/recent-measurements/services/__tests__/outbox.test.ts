import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MqttError } from "~/features/connection/services/mqtt/mqtt-errors";
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

vi.mock("~/shared/utils/app-lifecycle", () => ({
  onAppForeground: mockOnAppForeground,
}));

// trace utility: real module is fine but the no-op traces work everywhere.
// Stub to avoid any setup work in tests.
vi.mock("~/shared/utils/trace", () => ({
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

// Fresh module graph per test — the Outbox and outbox-state both carry
// module-level state we don't want bleeding across cases.
async function freshOutbox(transport: Transport, opts?: { concurrency?: number; retryBackoffMs?: readonly number[] }) {
  vi.resetModules();
  const outboxMod = await import("../outbox");
  const stateMod = await import("../outbox-state");
  const outbox = outboxMod.createOutbox({
    transport,
    concurrency: opts?.concurrency ?? 1,
    retryBackoffMs: opts?.retryBackoffMs ?? [],
  });
  return { outbox, stateMod };
}

function makeTransport(): Transport & { calls: { topic: string; payload: any }[]; resolveNext: () => void; rejectNext: (err: Error) => void } {
  const calls: { topic: string; payload: any }[] = [];
  let resolver: (() => void) | null = null;
  let rejecter: ((err: Error) => void) | null = null;
  return {
    calls,
    publish(topic, payload) {
      calls.push({ topic, payload });
      return new Promise<void>((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
      });
    },
    destroy() {},
    resolveNext() {
      resolver?.();
      resolver = null;
    },
    rejectNext(err: Error) {
      rejecter?.(err);
      rejecter = null;
    },
  };
}

const row = (overrides: Partial<{ id: string; status: "pending" | "failed" | "successful"; topic: string; result: object }> = {}) => ({
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
      mockGetMeasurementById.mockImplementation(async (id) => row({ id, status: "pending" }));

      const transport = makeTransport();
      const { stateMod } = await freshOutbox(transport);
      await flushMicrotasks();

      expect(mockGetMeasurements).toHaveBeenCalledWith(["pending", "failed"]);
      expect(stateMod.isProcessing("a")).toBe(true);
      expect(stateMod.isProcessing("b")).toBe(true);
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
      mockGetMeasurementById.mockResolvedValueOnce(row({ id: "row-1", topic: "exp/p", result: { v: 42 } }));
      const transport = makeTransport();
      const { outbox, stateMod } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      expect(stateMod.isProcessing("row-1")).toBe(true);

      // Wait for the worker to call transport.publish.
      for (let i = 0; i < 20 && transport.calls.length === 0; i++) await Promise.resolve();
      expect(transport.calls).toHaveLength(1);
      expect(transport.calls[0].topic).toBe("exp/p");
      expect(transport.calls[0].payload).toEqual({ v: 42, _client_id: "row-1" });

      transport.resolveNext();
      await flushMicrotasks(20);

      expect(mockMarkAsSuccessful).toHaveBeenCalledWith("row-1");
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(stateMod.isProcessing("row-1")).toBe(false);
    });
  });

  describe("worker — skip paths", () => {
    it("skips when the row is missing (e.g. deleted mid-flight)", async () => {
      mockGetMeasurementById.mockResolvedValueOnce(null);
      const transport = makeTransport();
      const { outbox, stateMod } = await freshOutbox(transport);

      outbox.enqueue("ghost");
      await flushMicrotasks(20);

      expect(transport.calls).toHaveLength(0);
      expect(mockMarkAsSuccessful).not.toHaveBeenCalled();
      expect(mockMarkAsFailed).not.toHaveBeenCalled();
      expect(stateMod.isProcessing("ghost")).toBe(false);
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
      const { outbox } = await freshOutbox(transport);

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
      const { outbox } = await freshOutbox(transport, { retryBackoffMs: [0] });

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
  });

  describe("enqueue / enqueueMany dedup", () => {
    it("enqueue dedupes ids already in flight", async () => {
      mockGetMeasurementById.mockImplementation(
        () => new Promise(() => undefined), // hang the worker
      );
      const transport = makeTransport();
      const { outbox, stateMod } = await freshOutbox(transport);

      outbox.enqueue("row-1");
      outbox.enqueue("row-1");
      await flushMicrotasks(10);

      // markEnqueued is the state source of truth — a duplicate enqueue
      // bails before adding to the underlying queue.
      expect(stateMod.isProcessing("row-1")).toBe(true);
    });

    it("enqueueMany adds only the novel ids", async () => {
      mockGetMeasurementById.mockImplementation(() => new Promise(() => undefined));
      const transport = makeTransport();
      const { outbox, stateMod } = await freshOutbox(transport);

      outbox.enqueue("a");
      outbox.enqueueMany(["a", "b", "c"]);
      await flushMicrotasks(10);

      expect(stateMod.isProcessing("a")).toBe(true);
      expect(stateMod.isProcessing("b")).toBe(true);
      expect(stateMod.isProcessing("c")).toBe(true);
    });
  });
});
