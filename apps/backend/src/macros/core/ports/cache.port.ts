export const CACHE_PORT = Symbol("MACRO_CACHE_PORT");

export abstract class CachePort {
  /**
   * Read-through cache for a single key.
   * Returns cached value on hit; on miss calls `fetchFn`,
   * stores the result, and returns it.
   */
  abstract tryCache<T>(key: string, fetchFn: () => Promise<T | null>): Promise<T | null>;

  /**
   * Batch read-through cache.
   * Returns a map of all resolved entries. For every cache miss,
   * `fetchFn` is called once with the missed keys; returned values
   * are stored and merged into the result.
   */
  abstract tryCacheMany<T>(
    keys: string[],
    fetchFn: (missedKeys: string[]) => Promise<Map<string, T>>,
  ): Promise<Map<string, T>>;

  /** Invalidate a single cached entry. */
  abstract invalidate(key: string): Promise<void>;
}
