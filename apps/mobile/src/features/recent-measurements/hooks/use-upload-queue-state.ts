import { useSyncExternalStore, useCallback } from "react";

import {
  getSnapshot,
  isProcessing as isProcessingState,
  subscribe,
  type UploadQueueState,
} from "../services/upload-queue-state";

// Reactive view of the UploadQueue for React components. Imports the
// dependency-free state module — *not* the queue implementation — so
// rendering a row doesn't pull in the MQTT + Cognito + env chain.
export function useUploadQueueState(): UploadQueueState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Per-row reactive view: returns true while the given id is in the queue
// (waiting or actively retrying). Re-renders only when the queue ticks.
export function useIsProcessing(id: string): boolean {
  const snapshotForId = useCallback(() => isProcessingState(id), [id]);
  return useSyncExternalStore(subscribe, snapshotForId, snapshotForId);
}
