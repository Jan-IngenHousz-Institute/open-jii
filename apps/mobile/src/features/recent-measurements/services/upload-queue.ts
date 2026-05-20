import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { addNetworkStateListener } from "expo-network";
import { getMeasurements } from "~/shared/db/measurements-storage";
import { onAppForeground } from "~/shared/utils/app-lifecycle";
import { createLogger } from "~/shared/utils/logger";
import { getTrace, startTrace } from "~/shared/utils/trace";

import { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS } from "./upload-constants";
import { isProcessing, markEnqueued, markEnqueuedMany, markSettled } from "./upload-queue-state";
import type { UploadQueueState } from "./upload-queue-state";
import { uploadWorker } from "./upload-worker";

export { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS };

const log = createLogger("upload-queue");

export interface UploadQueue {
  enqueue(id: string): void;
  enqueueMany(ids: readonly string[]): void;
  isProcessing(id: string): boolean;
}

const REHYDRATE_COOLDOWN_MS = 10_000;

class UploadQueueImpl implements UploadQueue {
  private readonly queue: AsyncQueuer<string>;
  private rehydrating = false;
  private lastRehydrateAt = 0;

  constructor() {
    log.info("init", { concurrency: UPLOAD_CONCURRENCY });
    this.queue = new AsyncQueuer<string>(this.runItem, {
      concurrency: UPLOAD_CONCURRENCY,
      asyncRetryerOptions: {
        maxAttempts: UPLOAD_RETRY_BACKOFF_MS.length + 1,
        backoff: "fixed",
        baseWait: (retryer) => UPLOAD_RETRY_BACKOFF_MS[retryer.store.state.currentAttempt - 1] ?? 0,
        throwOnError: "last",
        onRetry: (attempt, err) => {
          log.warn("worker error — retrying", { attempt, err: err.message });
          // attempt comes after the failed try; record on the trace so the
          // canonical event shows the full retry shape.
          // We don't know the id here (pacer doesn't pass it), so the trace
          // for the running item is updated inside uploadWorker.
        },
      },
      onSettled: (id) => {
        log.debug("settled", { id });
        markSettled(id);
        // If the worker bailed before calling end (e.g. row already
        // successful, or a non-MqttError bubbled out before classification),
        // close the trace here so we still get a canonical line.
        const t = getTrace(id);
        if (t) t.end("ok", { closed_by: "queue_settled" });
      },
    });
    this.wireNetworkListener();
    this.wireForegroundListener();
    void this.rehydrate();
  }

  enqueue(id: string): void {
    if (!markEnqueued(id)) {
      log.debug("enqueue skipped — already in queue", { id });
      return;
    }
    log.info("enqueue", { id });
    startTrace("upload", id, { source: "enqueue" });
    this.queue.addItem(id);
  }

  enqueueMany(ids: readonly string[]): void {
    const added = markEnqueuedMany(ids);
    if (added.length === 0) return;
    log.info("enqueueMany", { requested: ids.length, added: added.length });
    for (const id of added) {
      startTrace("upload", id, { source: "enqueueMany" });
      this.queue.addItem(id);
    }
  }

  isProcessing(id: string): boolean {
    return isProcessing(id);
  }

  private runItem = async (id: string): Promise<void> => {
    getTrace(id)?.event("worker_pickup");
    await uploadWorker(id);
  };

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

let singleton: UploadQueueImpl | null = null;

export function getUploadQueue(): UploadQueue {
  singleton = singleton ?? new UploadQueueImpl();
  return singleton;
}

// Re-export the state type so callers that only need it don't have to
// reach into the state module path.
export type { UploadQueueState };
