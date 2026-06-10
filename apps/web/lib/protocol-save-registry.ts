/**
 * Bridges a protocol editor's pending (debounced) save to the workbook run flow.
 *
 * Protocol code is edited in a `ProtocolCell` editor that persists changes to
 * the backend on a debounce. Running a protocol cell re-fetches that code from
 * the backend before sending it to the device. Without coordination, hitting
 * Run while a debounced save is still pending makes the device execute the
 * previously saved (stale) version of the protocol.
 *
 * Each editor registers a `flush` here, keyed by protocol id. The run flow calls
 * {@link flushProtocolSave} before reading the protocol back, so any pending edit
 * is persisted first. A module singleton keeps the editor (deep in the cell tree)
 * and the execution hook decoupled without threading a context through both.
 */

type FlushFn = () => Promise<void>;

const pendingFlushes = new Map<string, FlushFn>();

/**
 * Register a flush function for a protocol's editor. Returns a cleanup that
 * unregisters it — but only if it is still the active registration, so an
 * unmounting editor never clobbers a newer one for the same protocol.
 */
export function registerProtocolFlush(protocolId: string, flush: FlushFn): () => void {
  pendingFlushes.set(protocolId, flush);
  return () => {
    if (pendingFlushes.get(protocolId) === flush) {
      pendingFlushes.delete(protocolId);
    }
  };
}

/**
 * Flush any pending save for the given protocol, awaiting completion. No-op when
 * nothing is registered (e.g. the protocol is not currently being edited).
 */
export async function flushProtocolSave(protocolId: string): Promise<void> {
  const flush = pendingFlushes.get(protocolId);
  if (flush) await flush();
}

/** Test-only: clear all registrations between tests. */
export function __resetProtocolSaveRegistry(): void {
  pendingFlushes.clear();
}
