import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { addNetworkStateListener } from "expo-network";
import { AppState, type AppStateStatus } from "react-native";

import { getMeasurements } from "~/shared/db/measurements-storage";
import {
  isProcessing,
  markEnqueued,
  markSettled,
  type UploadQueueState,
} from "./upload-queue-state";
import { uploadWorker } from "./upload-worker";

// Orchestrates uploads with concurrency 8, per-item retry (1s/4s/15s), and
// pause-on-offline. IDs only — the DB is the source of truth for payloads,
// keeping bursts out of memory and making boot rehydration trivial.

export const UPLOAD_CONCURRENCY = 8;
export const UPLOAD_RETRY_BACKOFF_MS = [1_000, 4_000, 15_000];

export interface UploadQueue {
  enqueue(id: string): void;
  isProcessing(id: string): boolean;
}

class UploadQueueImpl implements UploadQueue {
  private readonly queue: AsyncQueuer<string>;
  private rehydrating = false;

  constructor() {
    console.log("[upload-queue] init", { concurrency: UPLOAD_CONCURRENCY });
    this.queue = new AsyncQueuer<string>(this.runItem, {
      concurrency: UPLOAD_CONCURRENCY,
      asyncRetryerOptions: {
        maxAttempts: UPLOAD_RETRY_BACKOFF_MS.length + 1,
        backoff: "fixed",
        baseWait: (retryer) =>
          UPLOAD_RETRY_BACKOFF_MS[retryer.store.state.currentAttempt - 1] ?? 0,
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
    this.wireAppStateListener();
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

  private wireAppStateListener() {
    AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        console.log("[upload-queue] app foregrounded — rehydrating");
        void this.rehydrate();
      }
    });
  }

  // Reads pending + failed rows from the DB and enqueues any IDs not
  // currently being processed. Used on construction (cold start) and on
  // every AppState foreground.
  private async rehydrate(): Promise<void> {
    if (this.rehydrating) return;
    this.rehydrating = true;
    try {
      const rows = await getMeasurements(["pending", "failed"]);
      console.log("[upload-queue] rehydrate", { found: rows.length });
      for (const row of rows) this.enqueue(row.id);
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
