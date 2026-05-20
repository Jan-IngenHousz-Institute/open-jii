import { useSyncExternalStore, useCallback } from "react";

import { getOutbox } from "~/shared/composition/upload";

import type { OutboxSnapshot } from "../services/outbox";

// Reactive view of the Outbox for React components. Reads directly from
// the Outbox singleton — there is no separate state module. The Outbox
// owns the snapshot, the per-id channel, and the settled stream.
export function useOutboxSnapshot(): OutboxSnapshot {
  const outbox = getOutbox();
  const subscribe = useCallback(
    (listener: () => void) => outbox.subscribeSnapshot(listener),
    [outbox],
  );
  const snapshot = useCallback(() => outbox.getSnapshot(), [outbox]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

// Per-row reactive view: returns true while the given id is in the
// Outbox. Subscribes to the per-id channel so only the row whose flag
// flipped wakes up — settles no longer wake every visible row.
export function useIsProcessing(id: string): boolean {
  const outbox = getOutbox();
  const subscribeId = useCallback(
    (listener: () => void) => outbox.subscribeProcessing(id, listener),
    [outbox, id],
  );
  const snapshotForId = useCallback(() => outbox.isProcessing(id), [outbox, id]);
  return useSyncExternalStore(subscribeId, snapshotForId, snapshotForId);
}
