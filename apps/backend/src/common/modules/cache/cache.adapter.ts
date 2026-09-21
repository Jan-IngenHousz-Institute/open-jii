import { Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import type { CachePort as ExperimentCachePort } from "../../../experiments/core/ports/cache.port";
import type { CachePort as MacroCachePort } from "../../../macros/core/ports/cache.port";
import type { CachePort as MetricsCachePort } from "../../../metrics/core/ports/cache.port";

export interface CacheNamespace {
  prefix: string;
  /** How long a value is served without asking the source again. */
  ttlMs: number;
  /**
   * How long past `ttlMs` a value stays servable while a fresh load runs
   * behind it. Unset means a value simply expires, as before.
   */
  staleMs?: number;
  /**
   * How long a caller with nothing to serve waits for a load before taking
   * `null`. The load keeps running and lands in the cache for the next one.
   * Unset means the caller waits for the load to finish.
   */
  waitMs?: number;
}

/** What a stale-capable namespace stores: the value and when it stops being fresh. */
interface Envelope<T> {
  value: T;
  freshUntil: number;
}

/**
 * Infrastructure adapter that implements the domain cache ports by delegating
 * to the NestJS cache-manager (in-memory / Redis).
 *
 * Owns key-prefixing, TTL, and the full read-through pattern so domain code
 * never touches cache primitives directly. Each domain registers its own
 * instance with its own key prefix and TTL via a factory provider.
 */
/**
 * One promise per key, so the map cannot carry each key's value type. What it
 * holds under a key is always that key's load, whose result is `T | null` by
 * construction in `tryCache`; nothing else writes to it.
 */
function sharedLoad<T>(running: Promise<unknown>): Promise<T | null> {
  return running as Promise<T | null>;
}

export class CacheAdapter implements MacroCachePort, MetricsCachePort, ExperimentCachePort {
  private readonly logger = new Logger(CacheAdapter.name);

  /** Loads already running, so a cold key costs one fetch rather than one per caller. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly cache: Cache,
    private readonly namespace: CacheNamespace,
  ) {}

  async tryCache<T>(key: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
    const cacheKey = `${this.namespace.prefix}${key}`;

    const entry = await this.read<T>(cacheKey);
    if (entry !== null && entry.freshUntil > Date.now()) {
      return entry.value;
    }

    const load = this.startLoad(cacheKey, fetchFn);

    // A stale value is served at once; the load refreshes it behind the reply.
    // Waiting here is what turned a slow source into an empty page.
    if (entry !== null) {
      return entry.value;
    }

    return this.awaitWithin(load, this.namespace.waitMs);
  }

  /**
   * One load per key at a time, outliving the caller that started it. A read
   * behind a short TTL is otherwise repeated by every caller that arrives
   * while the first one runs, and abandoned when that caller stops waiting.
   */
  private startLoad<T>(cacheKey: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
    const running = this.inFlight.get(cacheKey);
    if (running !== undefined) {
      return sharedLoad<T>(running);
    }

    const load = this.fetchAndStore(cacheKey, fetchFn).finally(() => {
      this.inFlight.delete(cacheKey);
    });
    this.inFlight.set(cacheKey, load);

    // A caller that stopped waiting leaves nobody to observe a rejection.
    load.catch((error: unknown) => {
      this.logger.warn({ msg: "Background cache load failed", cacheKey, error });
    });

    return load;
  }

  private async awaitWithin<T>(
    load: Promise<T | null>,
    waitMs: number | undefined,
  ): Promise<T | null> {
    if (waitMs === undefined) {
      return load;
    }

    let timer: NodeJS.Timeout | undefined;
    const gaveUp = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), waitMs);
    });

    try {
      return await Promise.race([load, gaveUp]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * A stale-capable namespace stores an envelope so freshness can outlive the
   * store's own expiry; every other namespace stores the bare value, which is
   * fresh for exactly as long as the store keeps it.
   */
  private async read<T>(cacheKey: string): Promise<Envelope<T> | null> {
    try {
      if (this.namespace.staleMs === undefined) {
        const value = (await this.cache.get<T>(cacheKey)) ?? null;
        return value === null ? null : { value, freshUntil: Number.POSITIVE_INFINITY };
      }

      return (await this.cache.get<Envelope<T>>(cacheKey)) ?? null;
    } catch (error) {
      this.logger.warn({ msg: "Cache read failed, treating as miss", cacheKey, error });
      return null;
    }
  }

  private async fetchAndStore<T>(
    cacheKey: string,
    fetchFn: () => Promise<T | null>,
  ): Promise<T | null> {
    const value = await fetchFn();

    if (value !== null && value !== undefined) {
      try {
        await this.store(cacheKey, value);
      } catch (error) {
        this.logger.warn({ msg: "Cache write failed", cacheKey, error });
      }
    }

    return value;
  }

  private async store<T>(cacheKey: string, value: T): Promise<void> {
    const { ttlMs, staleMs } = this.namespace;

    if (staleMs === undefined) {
      await this.cache.set(cacheKey, value, ttlMs);
      return;
    }

    const envelope: Envelope<T> = { value, freshUntil: Date.now() + ttlMs };
    await this.cache.set(cacheKey, envelope, ttlMs + staleMs);
  }

  async tryCacheMany<T>(
    keys: string[],
    fetchFn: (missedKeys: string[]) => Promise<Map<string, T>>,
  ): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missedKeys: string[] = [];

    for (const key of keys) {
      try {
        const cached = await this.cache.get<T>(`${this.namespace.prefix}${key}`);
        if (cached !== undefined && cached !== null) {
          result.set(key, cached);
          continue;
        }
      } catch (error) {
        this.logger.warn({ msg: "Cache read failed, treating as miss", key, error });
      }
      missedKeys.push(key);
    }

    if (missedKeys.length > 0) {
      const fetched = await fetchFn(missedKeys);

      for (const [key, value] of fetched) {
        result.set(key, value);
        try {
          await this.cache.set(`${this.namespace.prefix}${key}`, value, this.namespace.ttlMs);
        } catch (error) {
          this.logger.warn({ msg: "Cache write failed", key, error });
        }
      }
    }

    return result;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.cache.del(`${this.namespace.prefix}${key}`);
    } catch (error) {
      this.logger.warn({ msg: "Cache invalidation failed", key, error });
    }
  }
}
