/**
 * Lets the workbook run flow read a protocol's *live* editor code without a
 * backend round-trip.
 *
 * Protocol code is edited in a `ProtocolCell` editor and persisted to the
 * backend on a debounce. Running a protocol cell used to re-fetch that code
 * from the backend, which could read a stale (not-yet-saved) version. Instead, a
 * mounted editor registers a source here that returns its current valid code,
 * and the run flow reads it directly — running exactly what is on screen. When
 * no source is registered (editor unmounted) or it holds invalid code, the run
 * flow falls back to fetching the last saved version. Persistence still happens
 * independently via the editor's debounced autosave.
 *
 * A module singleton keeps the editor (deep in the cell tree) and the execution
 * hook decoupled without threading a context through both.
 */

/** Returns the editor's current protocol code if it is valid, else null. */
type ProtocolCodeSource = () => Record<string, unknown>[] | null;

const sources = new Map<string, ProtocolCodeSource>();

/**
 * Register the live-code source for a protocol's editor. Returns a cleanup that
 * unregisters it — but only if it is still the active source, so an unmounting
 * editor never clobbers a newer one for the same protocol.
 */
export function registerProtocolCodeSource(
  protocolId: string,
  getCode: ProtocolCodeSource,
): () => void {
  sources.set(protocolId, getCode);
  return () => {
    if (sources.get(protocolId) === getCode) {
      sources.delete(protocolId);
    }
  };
}

/** The live editor code for a protocol, or null when unavailable/invalid. */
export function getLiveProtocolCode(protocolId: string): Record<string, unknown>[] | null {
  const getCode = sources.get(protocolId);
  return getCode ? getCode() : null;
}

/** Test-only: clear all registrations between tests. */
export function __resetProtocolCodeRegistry(): void {
  sources.clear();
}
