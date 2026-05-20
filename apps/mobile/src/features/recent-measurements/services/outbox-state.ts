// Dependency-free state module the Outbox notifies. Consumers that only
// need to *observe* progress (the React UI) import from here, which keeps
// the MQTT chain out of their module graph.
//
// The Outbox in outbox.ts calls `markEnqueued` / `markSettled` as items
// move through it; this module fans those changes out to subscribers via
// a useSyncExternalStore-compatible API.

export interface OutboxSnapshot {
  isUploading: boolean;
  count: number;
}

const enqueued = new Set<string>();
const listeners = new Set<() => void>();
const settledListeners = new Set<(id: string) => void>();
// Per-id listeners. Rows on the Recent list subscribe by id so a settle
// wakes only the one row whose flag actually flipped, not all N rows.
const idListeners = new Map<string, Set<() => void>>();
let cachedSnapshot: OutboxSnapshot = { isUploading: false, count: 0 };

function notify() {
  const next: OutboxSnapshot = {
    isUploading: enqueued.size > 0,
    count: enqueued.size,
  };
  if (next.isUploading === cachedSnapshot.isUploading && next.count === cachedSnapshot.count) {
    return;
  }
  cachedSnapshot = next;
  Array.from(listeners).forEach((listener) => listener());
}

function notifyId(id: string) {
  const set = idListeners.get(id);
  if (!set) return;
  Array.from(set).forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeForId(id: string, listener: () => void): () => void {
  let set = idListeners.get(id);
  if (!set) {
    set = new Set();
    idListeners.set(id, set);
  }
  set.add(listener);
  return () => {
    const s = idListeners.get(id);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) idListeners.delete(id);
  };
}

// Fires once per item that reached a terminal state (successful or
// failed). Consumers use this to refresh DB-rooted views (react-query
// measurement lists) so each finished upload shows up in (near) real time,
// not only when the Outbox fully drains.
export function subscribeSettled(listener: (id: string) => void): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

export function getSnapshot(): OutboxSnapshot {
  return cachedSnapshot;
}

export function isProcessing(id: string): boolean {
  return enqueued.has(id);
}

// Internal — called by outbox.ts only.
export function markEnqueued(id: string): boolean {
  if (enqueued.has(id)) return false;
  enqueued.add(id);
  notify();
  notifyId(id);
  return true;
}

// Bulk variant — adds all novel ids and fires a single global notify
// plus one per-id notify per added id. Bursts (e.g. dev seeding 1000
// rows) would otherwise drive N global notifications.
export function markEnqueuedMany(ids: readonly string[]): string[] {
  const added: string[] = [];
  for (const id of ids) {
    if (enqueued.has(id)) continue;
    enqueued.add(id);
    added.push(id);
  }
  if (added.length > 0) {
    notify();
    for (const id of added) notifyId(id);
  }
  return added;
}

export function markSettled(id: string): void {
  if (!enqueued.delete(id)) return;
  notify();
  notifyId(id);
  Array.from(settledListeners).forEach((listener) => listener(id));
}
