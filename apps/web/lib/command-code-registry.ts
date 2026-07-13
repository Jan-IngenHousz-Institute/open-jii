/**
 * Lets the workbook run flow read a command's *live* editor code without a
 * backend round-trip.
 *
 * Command code is edited in a `CommandCell` editor and persisted to the
 * backend on a debounce. Running a command cell used to re-fetch that code
 * from the backend, which could read a stale (not-yet-saved) version. Instead, a
 * mounted editor registers a source here that returns its current valid code,
 * and the run flow reads it directly - running exactly what is on screen. When
 * no source is registered (editor unmounted) or it holds invalid code, the run
 * flow falls back to fetching the last saved version. Persistence still happens
 * independently via the editor's debounced autosave.
 *
 * A module singleton keeps the editor (deep in the cell tree) and the execution
 * hook decoupled without threading a context through both.
 */

/** Returns the editor's current command code if it is valid, else null. */
type CommandCodeSource = () => Record<string, unknown>[] | null;

const sources = new Map<string, CommandCodeSource>();

/**
 * Register the live-code source for a command's editor. Returns a cleanup that
 * unregisters it - but only if it is still the active source, so an unmounting
 * editor never clobbers a newer one for the same command.
 */
export function registerCommandCodeSource(
  commandId: string,
  getCode: CommandCodeSource,
): () => void {
  sources.set(commandId, getCode);
  return () => {
    if (sources.get(commandId) === getCode) {
      sources.delete(commandId);
    }
  };
}

/** The live editor code for a command, or null when unavailable/invalid. */
export function getLiveCommandCode(commandId: string): Record<string, unknown>[] | null {
  const getCode = sources.get(commandId);
  return getCode ? getCode() : null;
}

/** Test-only: clear all registrations between tests. */
export function __resetCommandCodeRegistry(): void {
  sources.clear();
}
