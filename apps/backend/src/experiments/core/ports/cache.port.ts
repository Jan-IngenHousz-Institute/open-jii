export const CACHE_PORT = Symbol("EXPERIMENT_CACHE_PORT");

export abstract class CachePort {
  /**
   * Read-through cache for a single key.
   * Returns cached value on hit; on miss calls `fetchFn`,
   * stores non-null results, and returns them.
   */
  abstract tryCache<T>(key: string, fetchFn: () => Promise<T | null>): Promise<T | null>;

  abstract invalidate(key: string): Promise<void>;
}
