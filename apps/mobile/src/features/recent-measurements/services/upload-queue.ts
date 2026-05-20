import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { addNetworkStateListener } from "expo-network";
import { getMeasurements } from "~/shared/db/measurements-storage";
import { onAppForeground } from "~/shared/utils/app-lifecycle";

import { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS } from "./upload-constants";
import { isProcessing, markEnqueued, markEnqueuedMany, markSettled } from "./upload-queue-state";
import type { UploadQueueState } from "./upload-queue-state";
import { uploadWorker } from "./upload-worker";

export { UPLOAD_CONCURRENCY, UPLOAD_RETRY_BACKOFF_MS };

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
    console.log("[upload-queue] init", { concurrency: UPLOAD_CONCURRENCY });
    this.queue = new AsyncQueuer<string>(this.runItem, {
      concurrency: UPLOAD_CONCURRENCY,
      asyncRetryerOptions: {
        maxAttempts: UPLOAD_RETRY_BACKOFF_MS.length + 1,
        backoff: "fixed",
        baseWait: (retryer) => UPLOAD_RETRY_BACKOFF_MS[retryer.store.state.currentAttempt - 1] ?? 0,
        throwOnError: "last",
        onRetry: (attempt, err) =>
          console.warn("[upload-queue] worker error — retrying", {
            attempt,
            err: err.message,
          }),
      },
      onSettled: (id) => {
        console.log("[upload-queue] settled", { id });
        markSettled(id);
      },
    });
    this.wireNetworkListener();
    this.wireForegroundListener();
    void this.rehydrate();
  }

  enqueue(id: string): void {
    if (!markEnqueued(id)) {
      console.log("[upload-queue] enqueue skipped — already in queue", { id });
      return;
    }
    console.log("[upload-queue] enqueue", { id });
    this.queue.addItem(id);
  }

  enqueueMany(ids: readonly string[]): void {
    const added = markEnqueuedMany(ids);
    if (added.length === 0) return;
    console.log("[upload-queue] enqueueMany", {
      requested: ids.length,
      added: added.length,
    });
    for (const id of added) this.queue.addItem(id);
  }

  isProcessing(id: string): boolean {
    return isProcessing(id);
  }

  private runItem = async (id: string): Promise<void> => {
    await uploadWorker(id);
  };

  private wireNetworkListener() {
    addNetworkStateListener(({ isInternetReachable }) => {
      // expo-network can transiently report null/undefined around state
      // transitions; treat anything not explicitly false as "connected" so
      // the queue doesn't pause on flaps.
      if (isInternetReachable === false) {
        console.log("[upload-queue] network offline — pausing");
        this.queue.stop();
      } else {
        console.log("[upload-queue] network online — resuming", { isInternetReachable });
        this.queue.start();
      }
    });
  }

  private wireForegroundListener() {
    onAppForeground(() => {
      console.log("[upload-queue] app foregrounded — rehydrating");
      void this.rehydrate();
    });
  }

  private async rehydrate(): Promise<void> {
    if (this.rehydrating) return;
    if (Date.now() - this.lastRehydrateAt < REHYDRATE_COOLDOWN_MS) {
      console.log("[upload-queue] rehydrate skipped — recent");
      return;
    }
    this.rehydrating = true;
    this.lastRehydrateAt = Date.now();
    try {
      const rows = await getMeasurements(["pending", "failed"]);
      console.log("[upload-queue] rehydrate", { found: rows.length });
      this.enqueueMany(rows.map((row) => row.id));
    } catch (err) {
      console.warn("[upload-queue] rehydrate failed:", err);
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
