// Tiny, dependency-free state module the UploadQueue notifies. Consumers
// who only need to *observe* queue progress (the React UI) import from
// here, which keeps the MQTT chain out of their module graph.
//
// The queue impl in upload-queue.ts calls `markEnqueued` / `markSettled`
// as items move through it; this module fans those changes out to
// subscribers via a useSyncExternalStore-compatible API.

export interface UploadQueueState {
  isUploading: boolean;
  count: number;
}

const enqueued = new Set<string>();
const listeners = new Set<() => void>();
let cachedSnapshot: UploadQueueState = { isUploading: false, count: 0 };

function notify() {
  const next: UploadQueueState = {
    isUploading: enqueued.size > 0,
    count: enqueued.size,
  };
  if (next.isUploading === cachedSnapshot.isUploading && next.count === cachedSnapshot.count) {
    return;
  }
  cachedSnapshot = next;
  Array.from(listeners).forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): UploadQueueState {
  return cachedSnapshot;
}

export function isProcessing(id: string): boolean {
  return enqueued.has(id);
}

// Internal — called by upload-queue.ts only.
export function markEnqueued(id: string): boolean {
  if (enqueued.has(id)) return false;
  enqueued.add(id);
  notify();
  return true;
}

export function markSettled(id: string): void {
  if (!enqueued.delete(id)) return;
  notify();
}
