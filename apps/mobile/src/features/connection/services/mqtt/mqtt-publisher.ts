import { AsyncRetryer } from "@tanstack/pacer/async-retryer";

import { MqttError } from "./mqtt-errors";
import { createPahoTransportFactory } from "./mqtt-transport";
import type { Transport, TransportFactory } from "./mqtt-transport";

// Time constants. Exported so tests can reference them.
export const IDLE_DISCONNECT_MS = 30_000;
export const RECONNECT_BACKOFF_MS = [1_000, 4_000, 15_000];
export const PUBLISH_TIMEOUT_MS = 30_000;
// Backpressure cap on outstanding (sent-but-unacked) publishes. Without
// this the drain loop hands every held item to paho at once on connect,
// which the lib + broker can't service fast enough — PUBACKs stall and
// publishes hit PUBLISH_TIMEOUT_MS. PUBACKs trigger a re-drain so the
// pipe stays full but bounded.
export const MAX_IN_FLIGHT = 16;

export interface MqttPublisher {
  publish(topic: string, payload: object): Promise<void>;
}

type TimerHandle = ReturnType<typeof setTimeout>;

interface Pending {
  topic: string;
  payload: object;
  resolve: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
  timeoutHandle: TimerHandle | null;
}

export interface MqttPublisherOptions {
  transportFactory: TransportFactory;
}

export class MqttPublisherImpl implements MqttPublisher {
  private readonly transportFactory: TransportFactory;
  private transport: Transport | null = null;
  private connecting: Promise<Transport | null> | null = null;
  // Sent to transport, waiting for broker PUBACK. Keyed by transport handle id.
  private readonly inFlight = new Map<number, Pending>();
  // Not yet sent (pre-connect, or held during reconnect).
  private held: Pending[] = [];
  private idleTimer: TimerHandle | null = null;
  private destroyed = false;

  constructor(opts: MqttPublisherOptions) {
    this.transportFactory = opts.transportFactory;
  }

  publish(topic: string, payload: object): Promise<void> {
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
        enqueuedAt: Date.now(),
        timeoutHandle: null,
      };
      item.timeoutHandle = setTimeout(() => {
        if (this.removePending(item)) {
          console.warn("[mqtt-publisher] publish timeout", { topic });
          item.reject(new MqttError("Timeout", `publish to ${topic} timed out`));
        }
      }, PUBLISH_TIMEOUT_MS);

      this.held.push(item);
      console.log("[mqtt-publisher] publish queued", {
        topic,
        held: this.held.length,
        inFlight: this.inFlight.size,
      });
      void this.drain();
    });
  }

  // Called by tests + lifecycle hooks. Destroys the active transport and
  // rejects every pending publish with kind: Disconnected.
  destroy() {
    if (this.destroyed) return;
    console.log("[mqtt-publisher] destroy");
    this.destroyed = true;
    this.cancelIdleTimer();
    if (this.transport) {
      this.transport.destroy();
      this.transport = null;
    }
    this.rejectAll(new MqttError("Disconnected", "publisher destroyed"));
  }

  private async drain(): Promise<void> {
    if (this.held.length === 0) return;
    const transport = await this.ensureTransport();
    if (!transport) return;
    let drained = 0;
    while (this.held.length > 0 && this.inFlight.size < MAX_IN_FLIGHT) {
      const item = this.held.shift();
      if (!item) break;
      const serialized = JSON.stringify(item.payload);
      try {
        const handle = transport.publish({ topic: item.topic, payload: serialized });
        this.inFlight.set(handle.id, item);
        drained++;
      } catch (err) {
        this.clearTimeout(item);
        console.warn("[mqtt-publisher] transport.publish threw", { topic: item.topic, err });
        item.reject(
          err instanceof MqttError
            ? err
            : new MqttError("PublishError", "publish failed", { cause: err }),
        );
      }
    }
    if (drained > 0) {
      console.log("[mqtt-publisher] drained to transport", {
        count: drained,
        inFlight: this.inFlight.size,
        heldRemaining: this.held.length,
      });
    }
  }

  private async ensureTransport(): Promise<Transport | null> {
    if (this.transport) return this.transport;
    if (this.connecting) return this.connecting;

    console.log("[mqtt-publisher] connecting");
    this.connecting = (async () => {
      try {
        const transport = await this.connectWithBackoff();
        this.wireTransport(transport);
        this.transport = transport;
        console.log("[mqtt-publisher] connected");
        return transport;
      } catch (err) {
        const mqttErr =
          err instanceof MqttError
            ? err
            : new MqttError("Disconnected", "connect failed", { cause: err });
        console.warn("[mqtt-publisher] connect failed — rejecting all pending", {
          kind: mqttErr.kind,
        });
        this.rejectAll(mqttErr);
        return null;
      } finally {
        this.connecting = null;
      }
    })();

    return this.connecting;
  }

  private async connectWithBackoff(): Promise<Transport> {
    // AsyncRetryer drives the [1s, 4s, 15s] schedule via a function-form
    // baseWait that reads the attempt that just failed from store state.
    // backoff: 'fixed' means the returned ms is used as-is per attempt.
    const retryer = new AsyncRetryer(() => this.transportFactory.connect(), {
      maxAttempts: RECONNECT_BACKOFF_MS.length + 1,
      backoff: "fixed",
      baseWait: (retryer) => RECONNECT_BACKOFF_MS[retryer.store.state.currentAttempt - 1] ?? 0,
      throwOnError: "last",
      onError: (err, _args, r) =>
        console.warn("[mqtt-publisher] connect attempt failed", {
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

  private wireTransport(transport: Transport) {
    transport.onDelivered((id) => {
      const item = this.inFlight.get(id);
      if (!item) return;
      this.inFlight.delete(id);
      this.clearTimeout(item);
      const ms = Date.now() - item.enqueuedAt;
      console.log("[mqtt-publisher] delivered (PUBACK)", {
        topic: item.topic,
        ms,
        inFlight: this.inFlight.size,
        held: this.held.length,
      });
      item.resolve();
      // Slot freed — pull the next held item in. If nothing held, fall
      // through to idle scheduling.
      if (this.held.length > 0) {
        void this.drain();
      } else {
        this.scheduleIdleTimer();
      }
    });

    transport.onDisconnect((reason) => {
      if (this.destroyed) return;
      console.warn("[mqtt-publisher] transport disconnected — holding + reconnecting", {
        reason,
        inFlight: this.inFlight.size,
      });
      // Surface unfinished publishes back to held for retransmit on the next
      // transport. inFlight publishes were not acked, so they're not safely
      // delivered — re-send. This is the "hold + retry" guarantee.
      Array.from(this.inFlight.values()).forEach((item) => this.held.push(item));
      this.inFlight.clear();
      try {
        this.transport?.destroy();
      } catch {
        // ignore
      }
      this.transport = null;
      void this.drain();
    });
  }

  private removePending(item: Pending): boolean {
    const heldIdx = this.held.indexOf(item);
    if (heldIdx >= 0) {
      this.held.splice(heldIdx, 1);
      return true;
    }
    const match = Array.from(this.inFlight.entries()).find(([, pending]) => pending === item);
    if (match) {
      this.inFlight.delete(match[0]);
      return true;
    }
    return false;
  }

  private rejectAll(err: MqttError) {
    const all: Pending[] = [...this.held, ...Array.from(this.inFlight.values())];
    this.held = [];
    this.inFlight.clear();
    for (const item of all) {
      this.clearTimeout(item);
      item.reject(err);
    }
  }

  private scheduleIdleTimer() {
    if (this.inFlight.size > 0 || this.held.length > 0) return;
    this.cancelIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.inFlight.size === 0 && this.held.length === 0 && this.transport) {
        console.log("[mqtt-publisher] idle — closing transport", { afterMs: IDLE_DISCONNECT_MS });
        this.transport.destroy();
        this.transport = null;
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
