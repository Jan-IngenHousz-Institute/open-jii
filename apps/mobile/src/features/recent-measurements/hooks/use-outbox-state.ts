import { useSyncExternalStore, useCallback } from "react";

import {
  getSnapshot,
  isProcessing as isProcessingState,
  subscribe,
  subscribeForId,
  type OutboxSnapshot,
} from "../services/outbox-state";

// Reactive view of the Outbox for React components. Imports the
// dependency-free state module — *not* the Outbox implementation — so
// rendering a row doesn't pull in the MQTT + Cognito + env chain.
export function useOutboxSnapshot(): OutboxSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Per-row reactive view: returns true while the given id is in the
// Outbox. Subscribes to the per-id channel so only the row whose flag
// flipped wakes up — settles no longer wake every visible row.
export function useIsProcessing(id: string): boolean {
  const subscribeId = useCallback((listener: () => void) => subscribeForId(id, listener), [id]);
  const snapshotForId = useCallback(() => isProcessingState(id), [id]);
  return useSyncExternalStore(subscribeId, snapshotForId, snapshotForId);
}
