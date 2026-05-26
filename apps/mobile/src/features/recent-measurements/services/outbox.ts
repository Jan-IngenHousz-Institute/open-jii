import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { addNetworkStateListener } from "expo-network";
import { isRetryableMqttError } from "~/features/connection/services/mqtt/mqtt-errors";
import type { Transport } from "~/features/connection/services/mqtt/mqtt-transport";
import {
  getMeasurementById,
  getMeasurements,
  markAsFailed,
  markAsSuccessful,
} from "~/shared/db/measurements-storage";
import { onAppForeground } from "~/shared/utils/app-lifecycle";
import { createLogger } from "~/shared/utils/logger";
import { getTrace, startTrace } from "~/shared/utils/trace";

import { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS } from "./upload-constants";

const log = createLogger("outbox");

// Transactional Outbox (Chris Richardson pattern). The `measurements`
// SQLite table is the queue: rows with status="pending" or "failed" are
// the work list. This module is the in-memory scheduler that drains them,
// and the single source of upload-progress reactivity for the UI.
//
// Responsibilities (single concept, deliberately not split):
// - Discover work: rehydrate `pending`/`failed` rows on cold start and on
//   app foreground.
// - Schedule: per-row retry via AsyncRetryer (3 attempts, [1, 4, 15]s).
// - Pause on offline, resume on reconnect.
// - Status transitions: pending|failed → successful on PUBACK; pending|
//   failed → failed on terminal error.
// - Reactive surface for the UI: per-id processing, snapshot, and
//   settled-burst events carrying terminal status (no DB round-trip
//   needed downstream).

export type SettledStatus = "successful" | "failed";

export interface SettledItem {
  id: string;
  status: SettledStatus;
}

export interface OutboxSnapshot {
  isUploading: boolean;
  count: number;
}

export interface Outbox {
  enqueue(id: string): void;
  enqueueMany(ids: readonly string[]): void;
  isProcessing(id: string): boolean;
  subscribeProcessing(id: string, listener: () => void): () => void;
  subscribeSettled(listener: (items: readonly SettledItem[]) => void): () => void;
  getSnapshot(): OutboxSnapshot;
  subscribeSnapshot(listener: () => void): () => void;
  // Detach external wiring (network + foreground listeners) and halt the
  // queue so a discarded instance goes inert. Called by the composition
  // root on hot-reload dispose — see shared/composition/upload.ts.
  destroy(): void;
}

export interface OutboxOptions {
  transport: Transport;
  concurrency?: number;
  retryBackoffMs?: readonly number[];
}

const REHYDRATE_COOLDOWN_MS = 10_000;

class OutboxImpl implements Outbox {
  private readonly transport: Transport;
  private readonly queue: AsyncQueuer<string>;
  private rehydrating = false;
  private lastRehydrateAt = 0;
  private destroyed = false;
  // Unsubscribers for external event sources (network + app foreground).
  // Held so destroy() can detach them; a leaked instance that keeps
  // listening would re-rehydrate and re-publish every pending row forever.
  private readonly subscriptions: (() => void)[] = [];

  // Progress state — single source of truth for the UI.
  private readonly enqueued = new Set<string>();
  private readonly idListeners = new Map<string, Set<() => void>>();
  private readonly snapshotListeners = new Set<() => void>();
  private readonly settledListeners = new Set<(items: readonly SettledItem[]) => void>();
  private cachedSnapshot: OutboxSnapshot = { isUploading: false, count: 0 };
  // Microtask coalescer: a burst of PUBACKs inside one JS turn produces
  // a single listener dispatch with every {id, status} from the burst.
  private settledPending: SettledItem[] = [];
  private settledFlushScheduled = false;

  constructor(opts: OutboxOptions) {
    this.transport = opts.transport;
    const concurrency = opts.concurrency ?? UPLOAD_CONCURRENCY;
    const backoff = opts.retryBackoffMs ?? UPLOAD_RETRY_BACKOFF_MS;
    log.info("init", { concurrency, backoffSteps: backoff.length });

    this.queue = new AsyncQueuer<string>((id) => this.runItem(id), {
      concurrency,
      asyncRetryerOptions: {
        maxAttempts: backoff.length + 1,
        backoff: "fixed",
        baseWait: (retryer) => backoff[retryer.store.state.currentAttempt - 1] ?? 0,
        throwOnError: "last",
        onRetry: (attempt, err) => {
          log.warn("worker error — retrying", { attempt, err: err.message });
        },
      },
      onSettled: (id) => {
        log.debug("settled", { id });
        this.releaseEnqueued(id);
        // If the worker bailed before calling end (e.g. row already
        // successful, or a non-MqttError bubbled out before classification),
        // close the trace here so we still get a canonical line.
        const t = getTrace(id);
        if (t) t.end("ok", { closed_by: "outbox_settled" });
      },
    });

    this.wireNetworkListener();
    this.wireForegroundListener();
    void this.rehydrate();
  }

  enqueue(id: string): void {
    if (this.destroyed) return;
    if (!this.markEnqueued(id)) {
      log.debug("enqueue skipped — already in outbox", { id });
      return;
    }
    log.info("enqueue", { id });
    this.queue.addItem(id);
  }

  enqueueMany(ids: readonly string[]): void {
    if (this.destroyed) return;
    const added = this.markEnqueuedMany(ids);
    if (added.length === 0) return;
    log.info("enqueueMany", { requested: ids.length, added: added.length });
    for (const id of added) {
      this.queue.addItem(id);
    }
  }

  isProcessing(id: string): boolean {
    return this.enqueued.has(id);
  }

  subscribeProcessing(id: string, listener: () => void): () => void {
    let set = this.idListeners.get(id);
    if (!set) {
      set = new Set();
      this.idListeners.set(id, set);
    }
    set.add(listener);
    return () => {
      const s = this.idListeners.get(id);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) this.idListeners.delete(id);
    };
  }

  // Fires once per microtask with every {id, status} that settled since
  // the previous flush. Carries terminal status so consumers can patch
  // their views without re-reading the DB.
  subscribeSettled(listener: (items: readonly SettledItem[]) => void): () => void {
    this.settledListeners.add(listener);
    return () => {
      this.settledListeners.delete(listener);
    };
  }

  getSnapshot(): OutboxSnapshot {
    return this.cachedSnapshot;
  }

  subscribeSnapshot(listener: () => void): () => void {
    this.snapshotListeners.add(listener);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  // Detach every external event source and halt the queue. Idempotent. The
  // transport is injected (owned by the composition root), so it is NOT
  // destroyed here — the root disposes it alongside this Outbox.
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    log.info("destroy");
    for (const unsubscribe of this.subscriptions.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
    }
    this.queue.stop();
    this.queue.clear();
    this.enqueued.clear();
    this.idListeners.clear();
    this.snapshotListeners.clear();
    this.settledListeners.clear();
    this.settledPending = [];
  }

  // --- internal progress state ---

  private markEnqueued(id: string): boolean {
    if (this.enqueued.has(id)) return false;
    this.enqueued.add(id);
    this.notifySnapshot();
    this.notifyId(id);
    return true;
  }

  private markEnqueuedMany(ids: readonly string[]): string[] {
    const added: string[] = [];
    for (const id of ids) {
      if (this.enqueued.has(id)) continue;
      this.enqueued.add(id);
      added.push(id);
    }
    if (added.length > 0) {
      this.notifySnapshot();
      for (const id of added) this.notifyId(id);
    }
    return added;
  }

  // Called from AsyncQueuer's onSettled. Cleanup only — removes the id
  // from the enqueued set, wakes per-id + snapshot listeners. The
  // SettledItem (with terminal status) is emitted by runItem inline at
  // the PUBACK / retry-exhaust point so the fact lives where it's known.
  private releaseEnqueued(id: string): void {
    if (!this.enqueued.delete(id)) return;
    this.notifySnapshot();
    this.notifyId(id);
  }

  private scheduleSettled(item: SettledItem): void {
    this.settledPending.push(item);
    if (this.settledFlushScheduled) return;
    this.settledFlushScheduled = true;
    queueMicrotask(() => {
      const items = this.settledPending;
      this.settledPending = [];
      this.settledFlushScheduled = false;
      if (this.settledListeners.size === 0) return;
      Array.from(this.settledListeners).forEach((listener) => listener(items));
    });
  }

  private notifySnapshot(): void {
    const next: OutboxSnapshot = {
      isUploading: this.enqueued.size > 0,
      count: this.enqueued.size,
    };
    if (
      next.isUploading === this.cachedSnapshot.isUploading &&
      next.count === this.cachedSnapshot.count
    ) {
      return;
    }
    this.cachedSnapshot = next;
    Array.from(this.snapshotListeners).forEach((listener) => listener());
  }

  private notifyId(id: string): void {
    const set = this.idListeners.get(id);
    if (!set) return;
    Array.from(set).forEach((listener) => listener());
  }

  // Per-item worker. Reads the row, builds the payload, calls
  // transport.publish, marks final status.
  //
  // Retry classification:
  // - Throw → AsyncRetryer catches, schedules the next attempt. Used for
  //   transient transport errors (Timeout, PublishError, Disconnected
  //   while in flight) and any non-MqttError.
  // - markAsFailed + return → terminal, no further retry from this
  //   enqueue. Used when the publisher rejects on a bad payload or a
  //   credential failure. The row can still be retried later via a fresh
  //   enqueue (e.g. user-driven retry on the Recent screen).
  private async runItem(id: string): Promise<void> {
    if (this.destroyed) return;
    const trace = startTrace("upload", id, { source: "outbox" });
    trace.event("outbox_pickup");
    const row = await getMeasurementById(id);
    if (!row) {
      log.debug("skip — row gone", { id });
      trace?.end("ok", { skipped: "row_gone" });
      return;
    }
    if (row.status === "successful") {
      log.debug("skip — already successful", { id });
      trace?.end("ok", { skipped: "already_successful" });
      return;
    }

    const payload = {
      ...row.data.measurementResult,
      // Embed the row UUID so an AWS IoT rule can deduplicate on the
      // downstream side if a crash between PUBACK and markAsSuccessful
      // leaves the row "pending" and we re-publish on next boot.
      _client_id: id,
    };

    trace?.setFields({ topic: row.data.topic, row_status_before: row.status });
    trace?.event("publish_start");
    log.info("publish start", { id, topic: row.data.topic });
    try {
      await this.transport.publish(row.data.topic, payload, { traceId: id });
      await markAsSuccessful(id);
      this.scheduleSettled({ id, status: "successful" });
      trace?.event("marked_successful");
      log.debug("publish ok → marked successful", { id });
      trace?.end("ok");
    } catch (err) {
      // A teardown in flight rejects pending publishes; don't reschedule them
      // onto a queue we're about to discard.
      if (this.destroyed) return;
      const kind = (err as { kind?: string })?.kind;
      if (isRetryableMqttError(err)) {
        log.warn("publish failed (retryable) — rethrowing for retry", { id, kind });
        trace?.event("publish_failed_retryable", { kind });
        throw err;
      }
      log.error("publish failed (terminal) — marking failed", {
        id,
        kind,
        err: (err as Error)?.message,
      });
      await markAsFailed(id);
      this.scheduleSettled({ id, status: "failed" });
      trace?.event("marked_failed", { kind });
      trace?.end("error", { err: (err as Error)?.message, kind });
    }
  }

  private wireNetworkListener() {
    const subscription = addNetworkStateListener(({ isInternetReachable }) => {
      if (this.destroyed) return;
      // expo-network can transiently report null/undefined around state
      // transitions; treat anything not explicitly false as "connected" so
      // the queue doesn't pause on flaps.
      if (isInternetReachable === false) {
        log.info("network offline — pausing");
        this.queue.stop();
      } else {
        log.info("network online — resuming", { isInternetReachable });
        this.queue.start();
      }
    });
    this.subscriptions.push(() => subscription.remove());
  }

  private wireForegroundListener() {
    const unsubscribe = onAppForeground(() => {
      if (this.destroyed) return;
      log.info("app foregrounded — rehydrating");
      void this.rehydrate();
    });
    this.subscriptions.push(unsubscribe);
  }

  private async rehydrate(): Promise<void> {
    if (this.destroyed) return;
    if (this.rehydrating) return;
    if (Date.now() - this.lastRehydrateAt < REHYDRATE_COOLDOWN_MS) {
      log.debug("rehydrate skipped — recent");
      return;
    }
    this.rehydrating = true;
    this.lastRehydrateAt = Date.now();
    try {
      const rows = await getMeasurements(["pending", "failed"]);
      log.info("rehydrate", { found: rows.length });
      this.enqueueMany(rows.map((row) => row.id));
    } catch (err) {
      log.warn("rehydrate failed", { err: (err as Error)?.message });
    } finally {
      this.rehydrating = false;
    }
  }
}

export function createOutbox(opts: OutboxOptions): Outbox {
  return new OutboxImpl(opts);
}
