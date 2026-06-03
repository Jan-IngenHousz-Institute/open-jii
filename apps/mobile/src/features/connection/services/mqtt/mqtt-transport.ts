import { createLogger } from "~/shared/observability/logger";
import { getSyncedUtcNow } from "~/shared/time/time-sync";
import { getTrace } from "~/shared/observability/trace";

import { MqttError } from "./mqtt-errors";
import { createPahoSessionFactory } from "./mqtt-paho-session";
import type { PahoSession, PahoSessionFactory } from "./mqtt-paho-session";

const log = createLogger("mqtt-transport");

export const IDLE_DISCONNECT_MS = 30_000;
export const PUBLISH_TIMEOUT_MS = 30_000;

export interface PublishMeta {
  // Correlation id used by the trace module (typically the measurement id).
  // When provided, transport lifecycle events (queued/wire_send/puback) are
  // attached to that trace so the canonical wide event covers DB → MQTT.
  traceId?: string;
}

export interface Transport {
  publish(topic: string, payload: object, meta?: PublishMeta): Promise<void>;
  destroy(): void;
}

export interface TransportOptions {
  pahoSessionFactory: PahoSessionFactory;
  publishTimeoutMs?: number;
  idleDisconnectMs?: number;
}

type TimerHandle = ReturnType<typeof setTimeout>;

interface Pending {
  topic: string;
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
  sentAt: number | null;
  timeoutHandle: TimerHandle | null;
  traceId?: string;
  settled: boolean;
}

const yieldToEventLoop = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

class TransportImpl implements Transport {
  private readonly pahoSessionFactory: PahoSessionFactory;
  private readonly publishTimeoutMs: number;
  private readonly idleDisconnectMs: number;

  // Single live MQTT session. Lazily connected on first publish, idle-closed
  // after `idleDisconnectMs` of zero in-flight, lazily reconnected on the
  // next publish after a disconnect. There is no background reconnect loop
  // — the Outbox's retry schedule drives reconnect cadence implicitly.
  private session: PahoSession | null = null;
  private connecting: Promise<PahoSession> | null = null;

  // Sent to the session, awaiting PUBACK. Keyed by paho-assigned handle id.
  private readonly inFlight = new Map<number, Pending>();
  private idleTimer: TimerHandle | null = null;
  private destroyed = false;

  constructor(opts: TransportOptions) {
    this.pahoSessionFactory = opts.pahoSessionFactory;
    this.publishTimeoutMs = opts.publishTimeoutMs ?? PUBLISH_TIMEOUT_MS;
    this.idleDisconnectMs = opts.idleDisconnectMs ?? IDLE_DISCONNECT_MS;
  }

  publish(topic: string, payload: object, meta?: PublishMeta): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new MqttError("Disconnected", "transport destroyed"));
    }

    this.cancelIdleTimer();

    return new Promise<void>((resolve, reject) => {
      const item: Pending = {
        topic,
        resolve,
        reject,
        enqueuedAt: getSyncedUtcNow(),
        sentAt: null,
        timeoutHandle: null,
        traceId: meta?.traceId,
        settled: false,
      };
      item.timeoutHandle = setTimeout(() => {
        this.settleReject(item, new MqttError("Timeout", `publish to ${topic} timed out`), {
          traceEvent: "transport_publish_timeout",
          traceFields: { topic },
        });
      }, this.publishTimeoutMs);

      if (item.traceId) {
        getTrace(item.traceId)?.event("transport_publish_queued", {
          in_flight: this.inFlight.size,
          has_session: this.session != null,
        });
      }

      void this.sendItem(item, payload);
    });
  }

  destroy() {
    if (this.destroyed) return;
    log.info("destroy");
    this.destroyed = true;
    this.cancelIdleTimer();
    if (this.session) {
      try {
        this.session.destroy();
      } catch {
        // ignore
      }
      this.session = null;
    }
    const items = Array.from(this.inFlight.values());
    this.inFlight.clear();
    const err = new MqttError("Disconnected", "transport destroyed");
    for (const item of items) {
      this.settleReject(item, err);
    }
  }

  // Connect-if-needed, serialize payload, hand to session.publish. Each
  // worker awaits its own send → the Outbox's worker concurrency bounds
  // in-flight here. No internal queue.
  private async sendItem(item: Pending, payload: object): Promise<void> {
    let session: PahoSession;
    try {
      session = await this.ensureConnected();
    } catch (err) {
      const mqttErr =
        err instanceof MqttError
          ? err
          : new MqttError("Disconnected", "connect failed", { cause: err });
      log.warn("publish failed pre-connect", {
        topic: item.topic,
        kind: mqttErr.kind,
        err: mqttErr.message,
      });
      this.settleReject(item, mqttErr, {
        traceEvent: "transport_connect_failed",
        traceFields: { kind: mqttErr.kind },
      });
      return;
    }

    if (item.settled) return;
    if (this.destroyed) {
      // destroy() only rejects items already tracked in `inFlight`; this one
      // isn't there yet, so reject it here or the caller hangs until the
      // PUBLISH_TIMEOUT_MS fires.
      this.settleReject(item, new MqttError("Disconnected", "transport destroyed"));
      return;
    }

    // Yield once before the CPU-heavy stringify so concurrent workers don't
    // all stall the JS thread back-to-back. JSON.stringify of a multi-MB
    // measurement payload is sync; the await lets paho's ack callbacks /
    // RN UI work interleave.
    await yieldToEventLoop();
    if (item.settled) return;
    if (this.destroyed) {
      this.settleReject(item, new MqttError("Disconnected", "transport destroyed"));
      return;
    }

    try {
      // stringify inside the try: a circular / non-serializable payload throws
      // here. Without the catch that rejection would be dropped (sendItem is
      // fire-and-forget from publish()) and the caller would hang to timeout.
      const serialized = JSON.stringify(payload);
      item.sentAt = getSyncedUtcNow();
      const handle = session.publish({ topic: item.topic, payload: serialized });
      if (item.settled) {
        // Timed out during the synchronous publish path — paho already
        // owns the message; the inFlight map intentionally does not
        // record it so the PUBACK arrives, finds nothing, and is dropped.
        return;
      }
      this.inFlight.set(handle.id, item);
      if (item.traceId) {
        getTrace(item.traceId)?.event("transport_wire_send", {
          bytes: serialized.length,
          in_flight: this.inFlight.size,
        });
      }
    } catch (err) {
      log.warn("session.publish threw", {
        topic: item.topic,
        err: (err as Error)?.message,
      });
      this.settleReject(
        item,
        err instanceof MqttError
          ? err
          : new MqttError("PublishError", "publish failed", { cause: err }),
        { traceEvent: "transport_wire_send_threw", traceFields: { err: (err as Error)?.message } },
      );
    }
  }

  private async ensureConnected(): Promise<PahoSession> {
    if (this.session) return this.session;
    if (this.connecting) return this.connecting;

    log.info("connecting");
    this.connecting = (async () => {
      try {
        const session = await this.pahoSessionFactory.connect();
        if (this.destroyed) {
          try {
            session.destroy();
          } catch {
            // ignore
          }
          throw new MqttError("Disconnected", "transport destroyed during connect");
        }
        this.wireSession(session);
        this.session = session;
        log.info("connected");
        return session;
      } catch (err) {
        const mqttErr =
          err instanceof MqttError
            ? err
            : new MqttError("Disconnected", "connect failed", { cause: err });
        log.warn("connect failed", { kind: mqttErr.kind });
        throw mqttErr;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  private wireSession(session: PahoSession) {
    session.onDelivered((id) => {
      const item = this.inFlight.get(id);
      if (!item) return;
      this.inFlight.delete(id);
      if (item.settled) return;
      item.settled = true;
      this.clearItemTimeout(item);
      const now = getSyncedUtcNow();
      const wireMs = item.sentAt != null ? now - item.sentAt : null;
      const queueMs = item.sentAt != null ? item.sentAt - item.enqueuedAt : null;
      const totalMs = now - item.enqueuedAt;
      log.debug("delivered (PUBACK)", {
        topic: item.topic,
        wireMs,
        queueMs,
        totalMs,
        inFlight: this.inFlight.size,
        traceId: item.traceId,
      });
      if (item.traceId) {
        getTrace(item.traceId)?.event("transport_puback", {
          wire_ms: wireMs,
          queue_ms: queueMs,
          transport_total_ms: totalMs,
        });
      }
      item.resolve();
      if (this.inFlight.size === 0) {
        this.scheduleIdleTimer();
      }
    });

    session.onDisconnect((reason) => {
      if (this.destroyed) return;
      log.warn("session disconnected — rejecting in-flight", {
        reason,
        inFlight: this.inFlight.size,
      });
      // The Outbox retries rejected items via its own backoff, which
      // triggers lazy reconnect via ensureConnected() on the next publish.
      const items = Array.from(this.inFlight.values());
      this.inFlight.clear();
      try {
        this.session?.destroy();
      } catch {
        // ignore
      }
      this.session = null;
      const err = new MqttError("Disconnected", reason.message);
      for (const item of items) {
        this.settleReject(item, err, {
          traceEvent: "transport_disconnect_requeue",
          traceFields: { reason: reason.message },
        });
      }
    });
  }

  private settleReject(
    item: Pending,
    err: Error,
    trace?: { traceEvent: string; traceFields?: Record<string, unknown> },
  ): void {
    if (item.settled) return;
    item.settled = true;
    this.clearItemTimeout(item);
    // Best-effort remove from inFlight (no-op if not present).
    const match = Array.from(this.inFlight.entries()).find(([, p]) => p === item);
    if (match) {
      this.inFlight.delete(match[0]);
    }
    if (trace && item.traceId) {
      getTrace(item.traceId)?.event(trace.traceEvent, trace.traceFields);
    }
    item.reject(err);
  }

  private scheduleIdleTimer() {
    if (this.inFlight.size > 0) return;
    this.cancelIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.inFlight.size > 0) return;
      if (!this.session) return;
      log.info("idle — closing session", { afterMs: this.idleDisconnectMs });
      try {
        this.session.destroy();
      } catch {
        // ignore
      }
      this.session = null;
    }, this.idleDisconnectMs);
  }

  private cancelIdleTimer() {
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearItemTimeout(item: Pending) {
    if (item.timeoutHandle != null) {
      clearTimeout(item.timeoutHandle);
      item.timeoutHandle = null;
    }
  }
}

export function createTransport(opts: TransportOptions): Transport {
  return new TransportImpl(opts);
}

export function createDefaultTransport(): Transport {
  return createTransport({ pahoSessionFactory: createPahoSessionFactory() });
}
