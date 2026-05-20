import { AsyncRetryer } from "@tanstack/pacer/async-retryer";
import { UPLOAD_CONCURRENCY } from "~/features/recent-measurements/services/upload-constants";
import { createLogger } from "~/shared/utils/logger";
import { getSyncedUtcNow } from "~/shared/utils/time-sync";
import { getTrace } from "~/shared/utils/trace";

import { MqttError } from "./mqtt-errors";
import { createPahoTransportFactory } from "./mqtt-transport";
import type { Transport, TransportFactory } from "./mqtt-transport";

const log = createLogger("mqtt-publisher");

export const IDLE_DISCONNECT_MS = 30_000;
export const RECONNECT_BACKOFF_MS = [1_000, 4_000, 15_000];
export const PUBLISH_TIMEOUT_MS = 30_000;

export const POOL_SIZE = 3;
export const MAX_IN_FLIGHT_PER_SLOT = Math.max(1, Math.floor(UPLOAD_CONCURRENCY / POOL_SIZE));

export interface PublishMeta {
  // Correlation id used by the trace module (typically the measurement id).
  // When provided, publisher lifecycle events (queued/slot/delivered) are
  // attached to that trace so the canonical wide event covers DB → MQTT.
  traceId?: string;
}

export interface MqttPublisher {
  publish(topic: string, payload: object, meta?: PublishMeta): Promise<void>;
}

type TimerHandle = ReturnType<typeof setTimeout>;

interface Pending {
  topic: string;
  payload: object;
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
  sentAt: number | null;
  timeoutHandle: TimerHandle | null;
  traceId?: string;
}

interface PoolSlot {
  readonly index: number;
  transport: Transport | null;
  connecting: Promise<Transport | null> | null;
  // Sent to this slot's transport, waiting for PUBACK. Keyed by transport
  // handle id (unique within this transport, not across slots).
  readonly inFlight: Map<number, Pending>;
}

export interface MqttPublisherOptions {
  transportFactory: TransportFactory;
  poolSize?: number;
}

const yieldToEventLoop = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

export class MqttPublisherImpl implements MqttPublisher {
  private readonly transportFactory: TransportFactory;
  private readonly slots: PoolSlot[];
  // Not yet sent (pre-connect, or held during reconnect of any slot).
  private held: Pending[] = [];
  private idleTimer: TimerHandle | null = null;
  private destroyed = false;
  // Drain runs as a single async task. Reentrant callers flip
  // `drainScheduled` so the in-flight run does another pass instead of
  // starting in parallel.
  private draining = false;
  private drainScheduled = false;

  constructor(opts: MqttPublisherOptions) {
    this.transportFactory = opts.transportFactory;
    const size = opts.poolSize ?? POOL_SIZE;
    this.slots = Array.from({ length: size }, (_, i) => ({
      index: i,
      transport: null,
      connecting: null,
      inFlight: new Map<number, Pending>(),
    }));
  }

  publish(topic: string, payload: object, meta?: PublishMeta): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new MqttError("Disconnected", "publisher destroyed"));
    }

    this.cancelIdleTimer();

    return new Promise<void>((resolve, reject) => {
      const item: Pending = {
        topic,
        payload,
        resolve,
        reject,
        enqueuedAt: getSyncedUtcNow(),
        sentAt: null,
        timeoutHandle: null,
        traceId: meta?.traceId,
      };
      item.timeoutHandle = setTimeout(() => {
        if (this.removePending(item)) {
          log.warn("publish timeout", { topic, traceId: item.traceId });
          if (item.traceId) getTrace(item.traceId)?.event("publish_timeout", { topic });
          item.reject(new MqttError("Timeout", `publish to ${topic} timed out`));
        }
      }, PUBLISH_TIMEOUT_MS);

      this.held.push(item);
      log.debug("publish queued", {
        topic,
        held: this.held.length,
        totalInFlight: this.totalInFlight(),
        traceId: item.traceId,
      });
      if (item.traceId) {
        getTrace(item.traceId)?.event("publisher_queued", {
          held: this.held.length,
          in_flight: this.totalInFlight(),
        });
      }
      this.ensureBootstrap();
      this.drain();
    });
  }

  destroy() {
    if (this.destroyed) return;
    log.info("destroy");
    this.destroyed = true;
    this.cancelIdleTimer();
    for (const slot of this.slots) {
      if (slot.transport) {
        try {
          slot.transport.destroy();
        } catch {
          // ignore
        }
        slot.transport = null;
      }
    }
    this.rejectAll(new MqttError("Disconnected", "publisher destroyed"));
  }

  // Distribute held items across connected slots round-robin, least-loaded
  // first. A single greedy fill of one slot would serialize PUBACKs behind
  // one TCP socket. Spreading across all connected slots gives parallel
  // PUBACK streams and a flatter wire_ms curve under burst load.
  //
  // Pure routing: never opens sockets. Bootstrap is handled by publish()
  // via ensureBootstrap(). Pool never scales up on demand — held queue waits.
  //
  // Runs as a fire-and-forget async task that yields between sends so big
  // bursts (e.g. UPLOAD_CONCURRENCY = 50, each with multi-MB JSON.stringify
  // + paho-mqtt encode on the JS thread) don't freeze the UI.
  private drain(): void {
    if (this.destroyed) return;
    if (this.draining) {
      this.drainScheduled = true;
      return;
    }
    void this.runDrain();
  }

  private async runDrain(): Promise<void> {
    this.draining = true;
    try {
      do {
        this.drainScheduled = false;
        if (this.destroyed) return;
        if (this.held.length === 0) continue;

        let sent = 0;
        const sentBySlot = new Map<number, number>();
        let progress = true;
        while (this.held.length > 0 && progress && !this.destroyed) {
          progress = false;
          const candidates = this.slots
            .filter((s) => s.transport && s.inFlight.size < MAX_IN_FLIGHT_PER_SLOT)
            .sort((a, b) => a.inFlight.size - b.inFlight.size);
          for (const slot of candidates) {
            if (this.held.length === 0) break;
            if (this.destroyed) return;
            if (this.trySendOne(slot)) {
              progress = true;
              sent++;
              sentBySlot.set(slot.index, (sentBySlot.get(slot.index) ?? 0) + 1);
              // Yield after every send. JSON.stringify + paho encode are
              // sync and CPU-heavy; without this the UI thread stalls for
              // the entire burst.
              await yieldToEventLoop();
            }
          }
        }
        if (sent > 0) {
          log.debug("drained round-robin", {
            sent,
            bySlot: Object.fromEntries(sentBySlot),
            heldRemaining: this.held.length,
            totalInFlight: this.totalInFlight(),
          });
        }
      } while (this.drainScheduled && !this.destroyed);
    } finally {
      this.draining = false;
    }
  }

  // Ensure at least one transport is connected or connecting. Called from
  // publish() so cold start / post-idle-close has a pipe to send through.
  // Opens only slot 0; never scales beyond one socket here.
  private ensureBootstrap(): void {
    if (this.slots.some((s) => s.transport != null || s.connecting != null)) return;
    const slot = this.slots[0];
    if (!slot) return;
    void this.ensureSlotConnected(slot).then((transport) => {
      if (transport) this.drain();
    });
  }

  private trySendOne(slot: PoolSlot): boolean {
    if (!slot.transport) return false;
    if (slot.inFlight.size >= MAX_IN_FLIGHT_PER_SLOT) return false;
    const item = this.held.shift();
    if (!item) return false;
    const serialized = JSON.stringify(item.payload);
    try {
      item.sentAt = getSyncedUtcNow();
      const handle = slot.transport.publish({ topic: item.topic, payload: serialized });
      slot.inFlight.set(handle.id, item);
      if (item.traceId) {
        getTrace(item.traceId)?.event("slot_send", {
          slot: slot.index,
          bytes: serialized.length,
        });
      }
      return true;
    } catch (err) {
      this.clearTimeout(item);
      log.warn("transport.publish threw", {
        slot: slot.index,
        topic: item.topic,
        err: (err as Error)?.message,
      });
      if (item.traceId) {
        getTrace(item.traceId)?.event("slot_send_threw", {
          slot: slot.index,
          err: (err as Error)?.message,
        });
      }
      item.reject(
        err instanceof MqttError
          ? err
          : new MqttError("PublishError", "publish failed", { cause: err }),
      );
      return false;
    }
  }

  private async ensureSlotConnected(slot: PoolSlot): Promise<Transport | null> {
    if (slot.transport) return slot.transport;
    if (slot.connecting) return slot.connecting;

    log.info("connecting", { slot: slot.index });
    slot.connecting = (async () => {
      try {
        const transport = await this.connectWithBackoff(slot);
        if (this.destroyed) {
          try {
            transport.destroy();
          } catch {
            // ignore
          }
          return null;
        }
        this.wireSlot(slot, transport);
        slot.transport = transport;
        log.info("connected", { slot: slot.index });
        return transport;
      } catch (err) {
        const mqttErr =
          err instanceof MqttError
            ? err
            : new MqttError("Disconnected", "connect failed", { cause: err });
        log.warn("slot connect failed", {
          slot: slot.index,
          kind: mqttErr.kind,
        });
        // Don't reject held items — other slots may still succeed. If all
        // slots fail, items time out via PUBLISH_TIMEOUT_MS and the upload
        // queue's retry path picks them up again.
        return null;
      } finally {
        slot.connecting = null;
      }
    })();

    return slot.connecting;
  }

  private async connectWithBackoff(slot: PoolSlot): Promise<Transport> {
    // AsyncRetryer drives the [1s, 4s, 15s] schedule via a function-form
    // baseWait that reads the attempt that just failed from store state.
    // backoff: 'fixed' means the returned ms is used as-is per attempt.
    const retryer = new AsyncRetryer(() => this.transportFactory.connect(), {
      maxAttempts: RECONNECT_BACKOFF_MS.length + 1,
      backoff: "fixed",
      baseWait: (retryer) => RECONNECT_BACKOFF_MS[retryer.store.state.currentAttempt - 1] ?? 0,
      throwOnError: "last",
      onError: (err, _args, r) =>
        log.warn("connect attempt failed", {
          slot: slot.index,
          attempt: r.store.state.currentAttempt,
          err: err.message,
        }),
    });
    try {
      const transport = await retryer.execute();
      if (!transport) {
        throw new MqttError("Disconnected", "retryer returned undefined");
      }
      return transport;
    } catch (err) {
      throw err instanceof MqttError
        ? err
        : new MqttError("Disconnected", "exhausted reconnect attempts", { cause: err });
    }
  }

  private wireSlot(slot: PoolSlot, transport: Transport) {
    transport.onDelivered((id) => {
      const item = slot.inFlight.get(id);
      if (!item) return;
      slot.inFlight.delete(id);
      this.clearTimeout(item);
      const now = getSyncedUtcNow();
      const wireMs = item.sentAt != null ? now - item.sentAt : null;
      const queueMs = item.sentAt != null ? item.sentAt - item.enqueuedAt : null;
      const totalMs = now - item.enqueuedAt;
      log.debug("delivered (PUBACK)", {
        slot: slot.index,
        topic: item.topic,
        wireMs,
        queueMs,
        totalMs,
        slotInFlight: slot.inFlight.size,
        totalInFlight: this.totalInFlight(),
        held: this.held.length,
        traceId: item.traceId,
      });
      if (item.traceId) {
        getTrace(item.traceId)?.event("puback", {
          slot: slot.index,
          wire_ms: wireMs,
          queue_ms: queueMs,
          publisher_total_ms: totalMs,
        });
      }
      item.resolve();
      // Slot freed — redistribute so least-loaded slot gets the next item,
      // not necessarily the one that just acked. If nothing held anywhere,
      // fall through to idle scheduling.
      if (this.held.length > 0) {
        this.drain();
      } else if (this.totalInFlight() === 0) {
        this.scheduleIdleTimer();
      }
    });

    transport.onDisconnect((reason) => {
      if (this.destroyed) return;
      log.warn("slot disconnected — holding + reconnecting", {
        slot: slot.index,
        reason,
        slotInFlight: slot.inFlight.size,
      });
      // Push this slot's unacked publishes back to held for redelivery via
      // any slot. Other slots are unaffected and keep running.
      Array.from(slot.inFlight.values()).forEach((item) => {
        item.sentAt = null;
        this.held.push(item);
        if (item.traceId) {
          getTrace(item.traceId)?.event("slot_disconnected_requeue", {
            slot: slot.index,
            reason: reason.message,
          });
        }
      });
      slot.inFlight.clear();
      try {
        slot.transport?.destroy();
      } catch {
        // ignore
      }
      slot.transport = null;
      this.drain();
    });
  }

  private removePending(item: Pending): boolean {
    const heldIdx = this.held.indexOf(item);
    if (heldIdx >= 0) {
      this.held.splice(heldIdx, 1);
      return true;
    }
    for (const slot of this.slots) {
      const match = Array.from(slot.inFlight.entries()).find(([, p]) => p === item);
      if (match) {
        slot.inFlight.delete(match[0]);
        return true;
      }
    }
    return false;
  }

  private rejectAll(err: MqttError) {
    const all: Pending[] = [...this.held];
    for (const slot of this.slots) {
      all.push(...Array.from(slot.inFlight.values()));
      slot.inFlight.clear();
    }
    this.held = [];
    for (const item of all) {
      this.clearTimeout(item);
      item.reject(err);
    }
  }

  private totalInFlight(): number {
    let n = 0;
    for (const slot of this.slots) n += slot.inFlight.size;
    return n;
  }

  private scheduleIdleTimer() {
    if (this.totalInFlight() > 0 || this.held.length > 0) return;
    this.cancelIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.totalInFlight() > 0 || this.held.length > 0) return;
      log.info("idle — closing all transports", { afterMs: IDLE_DISCONNECT_MS });
      for (const slot of this.slots) {
        if (slot.transport) {
          try {
            slot.transport.destroy();
          } catch {
            // ignore
          }
          slot.transport = null;
        }
      }
    }, IDLE_DISCONNECT_MS);
  }

  private cancelIdleTimer() {
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearTimeout(item: Pending) {
    if (item.timeoutHandle != null) {
      clearTimeout(item.timeoutHandle);
      item.timeoutHandle = null;
    }
  }
}

let singleton: MqttPublisherImpl | null = null;

export function getPublisher(): MqttPublisher {
  singleton =
    singleton ?? new MqttPublisherImpl({ transportFactory: createPahoTransportFactory() });
  return singleton;
}
