import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MqttError } from "../mqtt-errors";
import {
  MqttPublisherImpl,
  IDLE_DISCONNECT_MS,
  PUBLISH_TIMEOUT_MS,
  RECONNECT_BACKOFF_MS,
} from "../mqtt-publisher";
import type {
  DisconnectReason,
  Transport,
  TransportFactory,
  TransportMessage,
  TransportPublishHandle,
} from "../mqtt-transport";

// Stub the production transport's heavy native + env imports. Tests construct
// MqttPublisherImpl directly with a fake transport factory, so paho/Cognito/
// env never actually run — but importing the module triggers them.
vi.mock("paho-mqtt", () => ({ Client: vi.fn(), Message: vi.fn() }));
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: () => "stub" }));
vi.mock("~/shared/utils/generate-random-string", () => ({ generateRandomString: () => "rand" }));
vi.mock("../create-mqtt-connection", () => ({
  createSignedUrl: vi.fn(),
  getCredentials: vi.fn(),
}));
vi.mock("~/shared/utils/time-sync", () => ({
  getSyncedUtcNow: () => Date.now(),
}));

class FakeTransport implements Transport {
  private deliveredHandler: ((id: number) => void) | null = null;
  private disconnectHandler: ((reason: DisconnectReason) => void) | null = null;
  destroyed = false;
  publishes: Array<{ id: number; message: TransportMessage }> = [];
  private nextId = 1;

  publish(message: TransportMessage): TransportPublishHandle {
    const id = this.nextId++;
    this.publishes.push({ id, message });
    return { id };
  }

  onDelivered(handler: (id: number) => void) {
    this.deliveredHandler = handler;
  }

  onDisconnect(handler: (reason: DisconnectReason) => void) {
    this.disconnectHandler = handler;
  }

  destroy() {
    this.destroyed = true;
  }

  ack(index: number) {
    const publish = this.publishes[index];
    if (!publish) throw new Error(`no publish at index ${index}`);
    this.deliveredHandler?.(publish.id);
  }

  ackAll() {
    for (const publish of this.publishes) {
      this.deliveredHandler?.(publish.id);
    }
  }

  drop(reason: DisconnectReason = { message: "test drop" }) {
    this.disconnectHandler?.(reason);
  }
}

class FakeTransportFactory implements TransportFactory {
  transports: FakeTransport[] = [];
  // Each element controls whether the i'th connect() resolves or rejects.
  // `null` → succeed; an Error → reject with it.
  scripts: Array<Error | null> = [];
  private failures = 0;

  async connect(): Promise<Transport> {
    const scriptIndex = this.transports.length + this.failures;
    const scriptedFailure = this.scripts[scriptIndex];
    if (scriptedFailure instanceof Error) {
      this.failures++;
      throw scriptedFailure;
    }
    const transport = new FakeTransport();
    this.transports.push(transport);
    return transport;
  }

  current(): FakeTransport | undefined {
    return this.transports[this.transports.length - 1];
  }
}

// Lets pending microtasks (the publisher's drain, the AsyncRetryer's await
// chain) settle between time advances. vi.advanceTimersByTimeAsync(0) flushes
// the microtask queue without advancing timers — call it repeatedly to drain
// long async chains.
async function settle() {
  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
}

describe("MqttPublisher", () => {
  let factory: FakeTransportFactory;
  let publisher: MqttPublisherImpl;

  beforeEach(() => {
    vi.useFakeTimers();
    factory = new FakeTransportFactory();
    publisher = new MqttPublisherImpl({ transportFactory: factory });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens one connection for N publishes", async () => {
    const publish1 = publisher.publish("topic/a", { v: 1 });
    const publish2 = publisher.publish("topic/b", { v: 2 });
    const publish3 = publisher.publish("topic/c", { v: 3 });
    await settle();

    expect(factory.transports.length).toBe(1);
    const transport = factory.current()!;
    expect(transport.publishes.length).toBe(3);
    expect(transport.publishes[0]!.message.topic).toBe("topic/a");

    transport.ackAll();
    await expect(publish1).resolves.toBeUndefined();
    await expect(publish2).resolves.toBeUndefined();
    await expect(publish3).resolves.toBeUndefined();
  });

  it("publishes resolve only after broker ack", async () => {
    const onResolved = vi.fn();
    const publishPromise = publisher.publish("topic/x", { v: 1 }).then(onResolved);
    await settle();

    expect(factory.current()!.publishes.length).toBe(1);
    expect(onResolved).not.toHaveBeenCalled();

    factory.current()!.ack(0);
    await publishPromise;
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("holds and resends pending publishes when transport disconnects mid-flight", async () => {
    const publish1 = publisher.publish("topic/a", { v: 1 });
    const publish2 = publisher.publish("topic/b", { v: 2 });
    await settle();

    const first = factory.current()!;
    expect(first.publishes.length).toBe(2);

    first.drop();
    await settle();

    expect(factory.transports.length).toBe(2);
    const second = factory.transports[1]!;
    expect(second.publishes.length).toBe(2);
    expect(second.publishes.map((publish) => publish.message.topic)).toEqual([
      "topic/a",
      "topic/b",
    ]);

    second.ackAll();
    await expect(publish1).resolves.toBeUndefined();
    await expect(publish2).resolves.toBeUndefined();
  });

  it("times out pending publishes when reconnect exhausts retries", async () => {
    // Script: initial connect succeeds, then every reconnect attempt fails.
    // With the pool, a slot whose reconnects exhaust does NOT reject items —
    // they stay held until PUBLISH_TIMEOUT_MS fires, so the upload queue's
    // retry path can pick them up cleanly. (Other slots may still work; for
    // this test we use pool size 1 to mirror the original single-slot case.)
    publisher = new MqttPublisherImpl({ transportFactory: factory, poolSize: 1 });
    factory.scripts = [
      null,
      new Error("network down 1"),
      new Error("network down 2"),
      new Error("network down 3"),
      new Error("network down 4"),
    ];

    const publish1 = publisher.publish("topic/a", { v: 1 });
    const publish2 = publisher.publish("topic/b", { v: 2 });
    await settle();
    expect(factory.transports.length).toBe(1);

    factory.current()!.drop();
    await settle();

    for (const ms of RECONNECT_BACKOFF_MS) {
      await vi.advanceTimersByTimeAsync(ms);
      await settle();
    }

    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS + 1);

    await expect(publish1).rejects.toMatchObject({ kind: "Timeout" });
    await expect(publish2).rejects.toMatchObject({ kind: "Timeout" });
  });

  it("closes the transport after idle timeout", async () => {
    const publishPromise = publisher.publish("topic/a", { v: 1 });
    await settle();
    const transport = factory.current()!;
    transport.ack(0);
    await publishPromise;

    expect(transport.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1);
    expect(transport.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(transport.destroyed).toBe(true);
  });

  it("opens a fresh transport after idle close on next publish", async () => {
    const publish1 = publisher.publish("topic/a", { v: 1 });
    await settle();
    factory.current()!.ack(0);
    await publish1;
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS + 1);
    expect(factory.current()!.destroyed).toBe(true);

    const publish2 = publisher.publish("topic/b", { v: 2 });
    await settle();
    expect(factory.transports.length).toBe(2);
    factory.transports[1]!.ack(0);
    await expect(publish2).resolves.toBeUndefined();
  });

  it("times out the publish when initial slot connect exhausts retries", async () => {
    // Pool size 1 — no other slot to fall back to. Connect retries exhaust,
    // item stays held, PUBLISH_TIMEOUT_MS fires.
    publisher = new MqttPublisherImpl({ transportFactory: factory, poolSize: 1 });
    factory.scripts = [
      new Error("init 1"),
      new Error("init 2"),
      new Error("init 3"),
      new Error("init 4"),
    ];

    const publishPromise = publisher.publish("topic/a", { v: 1 });
    for (const ms of RECONNECT_BACKOFF_MS) {
      await vi.advanceTimersByTimeAsync(ms);
      await settle();
    }
    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS + 1);

    const err = await publishPromise.catch((rejection) => rejection);
    expect(err).toBeInstanceOf(MqttError);
    expect((err as MqttError).kind).toBe("Timeout");
  });

  it("publish rejects with Timeout when broker never acks", async () => {
    const publishPromise = publisher.publish("topic/a", { v: 1 });
    await settle();
    expect(factory.current()!.publishes.length).toBe(1);

    // Broker never acks; let the publish timeout fire.
    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS + 1);

    const err = await publishPromise.catch((rejection) => rejection);
    expect(err).toBeInstanceOf(MqttError);
    expect((err as MqttError).kind).toBe("Timeout");
  });

  it("isRetryableMqttError honors kind semantics", async () => {
    const { isRetryableMqttError } = await import("../mqtt-errors");
    expect(isRetryableMqttError(new MqttError("PublishError", "x"))).toBe(true);
    expect(isRetryableMqttError(new MqttError("Timeout", "x"))).toBe(true);
    expect(isRetryableMqttError(new MqttError("Disconnected", "x"))).toBe(false);
    expect(isRetryableMqttError(new MqttError("CredentialError", "x"))).toBe(false);
    expect(isRetryableMqttError(new Error("plain"))).toBe(true);
  });

  it("destroy() rejects pending and held publishes with Disconnected", async () => {
    const publish1 = publisher.publish("topic/a", { v: 1 });
    await settle();

    publisher.destroy();
    const err = await publish1.catch((rejection) => rejection);
    expect(err).toBeInstanceOf(MqttError);
    expect((err as MqttError).kind).toBe("Disconnected");
  });

  it("spreads publishes across the pool when held > per-slot capacity", async () => {
    // MAX_IN_FLIGHT_PER_SLOT is 8 in production. With 9 publishes, slot 0
    // fills to 8 and the 9th lands on slot 1, requiring a second transport.
    const N = 9;
    const publishes = Array.from({ length: N }, (_, i) =>
      publisher.publish(`topic/${i}`, { v: i }),
    );
    await settle();

    expect(factory.transports.length).toBeGreaterThanOrEqual(2);
    const total = factory.transports.reduce((sum, t) => sum + t.publishes.length, 0);
    expect(total).toBe(N);

    for (const transport of factory.transports) transport.ackAll();
    await Promise.all(publishes);
  });

  it("only opens one transport for a single publish (no eager pool warmup)", async () => {
    const publishPromise = publisher.publish("topic/a", { v: 1 });
    await settle();

    expect(factory.transports.length).toBe(1);
    factory.current()!.ack(0);
    await expect(publishPromise).resolves.toBeUndefined();
  });

  it("isolates slot disconnects — surviving slots keep delivering", async () => {
    // Force two slots to come up by publishing more than one slot can hold.
    const N = 10;
    const publishes = Array.from({ length: N }, (_, i) =>
      publisher.publish(`topic/${i}`, { v: i }),
    );
    await settle();

    expect(factory.transports.length).toBeGreaterThanOrEqual(2);
    const [first, second] = factory.transports;
    if (!first || !second) throw new Error("expected at least two transports");

    // Drop the first slot. Items it carried go back to held + redelivered on
    // its next transport. The second slot keeps acking unaffected.
    first.drop();
    second.ackAll();
    await settle();

    // First slot reconnects (3rd transport overall) and gets the held items.
    expect(factory.transports.length).toBeGreaterThanOrEqual(3);
    for (const transport of factory.transports) transport.ackAll();
    await Promise.all(publishes);
  });
});
