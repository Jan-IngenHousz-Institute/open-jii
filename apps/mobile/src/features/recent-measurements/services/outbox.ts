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

import {
  isProcessing as isProcessingState,
  markEnqueued,
  markEnqueuedMany,
  markSettled,
} from "./outbox-state";
import { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS } from "./upload-constants";

const log = createLogger("outbox");

// Transactional Outbox (Chris Richardson pattern). The `measurements`
// SQLite table is the queue: rows with status="pending" or "failed" are
// the work list. This module is the in-memory scheduler that drains them.
//
// Responsibilities (single concept, deliberately not split):
// - Discover work: rehydrate `pending`/`failed` rows on cold start and on
//   app foreground.
// - Schedule: per-row retry via AsyncRetryer (3 attempts, [1, 4, 15]s).
// - Pause on offline, resume on reconnect.
// - Status transitions: pending|failed → successful on PUBACK; pending|
//   failed → failed on terminal error.
// - Observability: notify outbox-state.ts so React can render progress.

export interface Outbox {
  enqueue(id: string): void;
  enqueueMany(ids: readonly string[]): void;
  isProcessing(id: string): boolean;
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
  private readonly sources = new Map<string, string>();

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
        markSettled(id);
        this.sources.delete(id);
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
    if (!markEnqueued(id)) {
      log.debug("enqueue skipped — already in outbox", { id });
      return;
    }
    log.info("enqueue", { id });
    this.sources.set(id, "enqueue");
    this.queue.addItem(id);
  }

  enqueueMany(ids: readonly string[]): void {
    const added = markEnqueuedMany(ids);
    if (added.length === 0) return;
    log.info("enqueueMany", { requested: ids.length, added: added.length });
    for (const id of added) {
      this.sources.set(id, "enqueueMany");
      this.queue.addItem(id);
    }
  }

  isProcessing(id: string): boolean {
    return isProcessingState(id);
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
    const source = this.sources.get(id) ?? "unknown";
    const trace = startTrace("upload", id, { source });
    trace.event("outbox_pickup");
    const row = await getMeasurementById(id);
    if (!row) {
      log.info("skip — row gone", { id });
      trace?.end("ok", { skipped: "row_gone" });
      return;
    }
    if (row.status === "successful") {
      log.info("skip — already successful", { id });
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
      trace?.event("marked_successful");
      trace?.end("ok");
      log.info("publish ok → marked successful", { id });
    } catch (err) {
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
      trace?.event("marked_failed", { kind });
      trace?.end("error", { err: (err as Error)?.message, kind });
    }
  }

  private wireNetworkListener() {
    addNetworkStateListener(({ isInternetReachable }) => {
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
  }

  private wireForegroundListener() {
    onAppForeground(() => {
      log.info("app foregrounded — rehydrating");
      void this.rehydrate();
    });
  }

  private async rehydrate(): Promise<void> {
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
