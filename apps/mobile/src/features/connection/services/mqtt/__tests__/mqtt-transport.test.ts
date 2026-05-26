import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MqttError } from "../mqtt-errors";
import type {
  DisconnectReason,
  PahoSession,
  PahoSessionFactory,
  PahoSessionMessage,
  PahoPublishHandle,
} from "../mqtt-paho-session";
import { IDLE_DISCONNECT_MS, PUBLISH_TIMEOUT_MS, createTransport } from "../mqtt-transport";

// Stub the production paho-session's native + env imports. Tests construct
// the Transport directly with a fake session factory, so paho/Cognito/env
// never actually run — but importing the module triggers them.
vi.mock("paho-mqtt", () => ({ Client: vi.fn(), Message: vi.fn() }));
vi.mock("react-native-get-random-values", () => ({}));
vi.mock("~/shared/stores/environment-store", () => ({ getEnvVar: () => "stub" }));
vi.mock("~/shared/utils/generate-random-string", () => ({ generateRandomString: () => "rand" }));
vi.mock("../aws-iot-auth", () => ({
  createSignedUrl: vi.fn(),
  getCredentials: vi.fn(),
}));
vi.mock("~/shared/utils/time-sync", () => ({
  getSyncedUtcNow: () => Date.now(),
}));

class FakeSession implements PahoSession {
  private deliveredHandler: ((id: number) => void) | null = null;
  private disconnectHandler: ((reason: DisconnectReason) => void) | null = null;
  destroyed = false;
  publishes: { id: number; message: PahoSessionMessage }[] = [];
  private nextId = 1;

  publish(message: PahoSessionMessage): PahoPublishHandle {
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
    const p = this.publishes[index];
    if (!p) throw new Error(`no publish at index ${index}`);
    this.deliveredHandler?.(p.id);
  }

  ackAll() {
    for (const p of this.publishes) this.deliveredHandler?.(p.id);
  }

  drop(reason: DisconnectReason = { message: "test drop" }) {
    this.disconnectHandler?.(reason);
  }
}

class FakeSessionFactory implements PahoSessionFactory {
  sessions: FakeSession[] = [];
  // Each element controls whether the i'th connect() resolves or rejects.
  // `null` → succeed; an Error → reject with it.
  scripts: (Error | null)[] = [];
  private failures = 0;

  connect(): Promise<PahoSession> {
    const idx = this.sessions.length + this.failures;
    const scripted = this.scripts[idx];
    if (scripted instanceof Error) {
      this.failures++;
      return Promise.reject(scripted);
    }
    const session = new FakeSession();
    this.sessions.push(session);
    return Promise.resolve(session);
  }

  current(): FakeSession | undefined {
    return this.sessions[this.sessions.length - 1];
  }
}

// Narrowing helper: asserts a possibly-undefined value is present and returns
// it typed as non-nullable, avoiding non-null assertions in test bodies.
function assertDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined`);
  }
  return value;
}

// Drain microtasks between fake-timer advances. `advanceTimersByTimeAsync(0)`
// flushes the microtask queue without moving time — call it a few times to
// settle long async chains (ensureConnected, sendItem, etc).
async function settle() {
  for (let i = 0; i < 8; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
}

describe("Transport", () => {
  let factory: FakeSessionFactory;
  let transport: ReturnType<typeof createTransport>;

  beforeEach(() => {
    vi.useFakeTimers();
    factory = new FakeSessionFactory();
    transport = createTransport({ pahoSessionFactory: factory });
  });

  afterEach(() => {
    transport.destroy();
    vi.useRealTimers();
  });

  it("opens one session lazily and hands publishes to it", async () => {
    const p1 = transport.publish("topic/a", { v: 1 });
    const p2 = transport.publish("topic/b", { v: 2 });
    await settle();

    expect(factory.sessions.length).toBe(1);
    const session = assertDefined(factory.current(), "current session");
    expect(session.publishes.map((p) => p.message.topic)).toEqual(["topic/a", "topic/b"]);

    session.ackAll();
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined();
  });

  it("resolves a publish only after the broker PUBACK arrives", async () => {
    const onResolved = vi.fn();
    const p = transport.publish("topic/x", { v: 1 }).then(onResolved);
    await settle();

    expect(assertDefined(factory.current(), "current session").publishes.length).toBe(1);
    expect(onResolved).not.toHaveBeenCalled();

    assertDefined(factory.current(), "current session").ack(0);
    await p;
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("rejects with Disconnected when the session drops in flight", async () => {
    const p1 = transport.publish("topic/a", { v: 1 });
    const p2 = transport.publish("topic/b", { v: 2 });
    await settle();
    const first = assertDefined(factory.current(), "current session");
    expect(first.publishes.length).toBe(2);

    first.drop({ message: "kicked" });
    await settle();

    // Both pending publishes reject — the Outbox's retry policy is the
    // single tier that re-enqueues; the Transport does not hold them.
    await expect(p1).rejects.toMatchObject({ kind: "Disconnected" });
    await expect(p2).rejects.toMatchObject({ kind: "Disconnected" });
    // No background reconnect; the dropped session is the only one so far.
    expect(factory.sessions.length).toBe(1);
  });

  it("lazily reconnects on the next publish after a disconnect", async () => {
    const p1 = transport.publish("topic/a", { v: 1 });
    await settle();
    assertDefined(factory.current(), "current session").drop();
    await settle();
    await expect(p1).rejects.toMatchObject({ kind: "Disconnected" });

    // A fresh publish after the drop triggers a new session.
    const p2 = transport.publish("topic/b", { v: 2 });
    await settle();
    expect(factory.sessions.length).toBe(2);

    assertDefined(factory.current(), "current session").ackAll();
    await expect(p2).resolves.toBeUndefined();
  });

  it("rejects with Disconnected when initial connect fails", async () => {
    factory.scripts = [new Error("network down")];

    const p = transport.publish("topic/a", { v: 1 });
    await settle();

    await expect(p).rejects.toMatchObject({ kind: "Disconnected" });
    expect(factory.sessions.length).toBe(0);
  });

  it("rejects with Timeout when the broker never acks", async () => {
    const p = transport.publish("topic/a", { v: 1 });
    await settle();
    expect(assertDefined(factory.current(), "current session").publishes.length).toBe(1);

    await vi.advanceTimersByTimeAsync(PUBLISH_TIMEOUT_MS + 1);
    await expect(p).rejects.toMatchObject({ kind: "Timeout" });
  });

  it("destroy() rejects pending publishes with Disconnected", async () => {
    const p = transport.publish("topic/a", { v: 1 });
    await settle();

    transport.destroy();
    await expect(p).rejects.toMatchObject({ kind: "Disconnected" });
  });

  it("publish after destroy rejects immediately", async () => {
    transport.destroy();
    await expect(transport.publish("topic/a", { v: 1 })).rejects.toMatchObject({
      kind: "Disconnected",
    });
  });

  it("closes the session after IDLE_DISCONNECT_MS with no in-flight publishes", async () => {
    const p = transport.publish("topic/a", { v: 1 });
    await settle();
    const session = assertDefined(factory.current(), "current session");
    session.ack(0);
    await p;

    expect(session.destroyed).toBe(false);
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS + 1);
    expect(session.destroyed).toBe(true);
  });

  it("does not close the session while a publish is still in flight", async () => {
    // Use a long publish timeout so the publish stays in flight past the idle
    // window — this test asserts idle behavior, not the publish-timeout path.
    transport = createTransport({
      pahoSessionFactory: factory,
      publishTimeoutMs: IDLE_DISCONNECT_MS * 10,
    });
    const p = transport.publish("topic/a", { v: 1 });
    await settle();
    const session = assertDefined(factory.current(), "current session");

    // Advance well past idle timeout — but the publish is still awaiting ack.
    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS + 1000);
    expect(session.destroyed).toBe(false);

    session.ack(0);
    await p;
  });

  it("a new publish after idle close opens a fresh session", async () => {
    const p1 = transport.publish("topic/a", { v: 1 });
    await settle();
    assertDefined(factory.current(), "current session").ack(0);
    await p1;

    await vi.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS + 1);
    expect(assertDefined(factory.sessions[0], "first session").destroyed).toBe(true);

    const p2 = transport.publish("topic/b", { v: 2 });
    await settle();
    expect(factory.sessions.length).toBe(2);
    assertDefined(factory.current(), "current session").ackAll();
    await expect(p2).resolves.toBeUndefined();
  });
});

describe("isRetryableMqttError", () => {
  it("classifies kinds: PublishError/Timeout/Disconnected retryable, CredentialError terminal", async () => {
    const { isRetryableMqttError } = await import("../mqtt-errors");
    expect(isRetryableMqttError(new MqttError("PublishError", "x"))).toBe(true);
    expect(isRetryableMqttError(new MqttError("Timeout", "x"))).toBe(true);
    expect(isRetryableMqttError(new MqttError("Disconnected", "x"))).toBe(true);
    expect(isRetryableMqttError(new MqttError("CredentialError", "x"))).toBe(false);
    expect(isRetryableMqttError(new Error("plain"))).toBe(true);
  });
});
