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
const settledListeners = new Set<(id: string) => void>();
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

// Fires once per item that actually leaves the queue (worker reached a
// terminal state — successful or failed). Consumers use this to refresh
// DB-rooted views (react-query measurement lists) so each finished upload
// shows up in (near) real time, not only when the queue fully drains.
export function subscribeSettled(listener: (id: string) => void): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
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

// Bulk variant — adds all novel ids and fires a single notify. Bursts
// (e.g. dev seeding 1000 rows) would otherwise drive N notifications and
// N×listeners listener calls, freezing the JS thread.
export function markEnqueuedMany(ids: readonly string[]): string[] {
  const added: string[] = [];
  for (const id of ids) {
    if (enqueued.has(id)) continue;
    enqueued.add(id);
    added.push(id);
  }
  if (added.length > 0) notify();
  return added;
}

export function markSettled(id: string): void {
  if (!enqueued.delete(id)) return;
  notify();
  Array.from(settledListeners).forEach((listener) => listener(id));
}
