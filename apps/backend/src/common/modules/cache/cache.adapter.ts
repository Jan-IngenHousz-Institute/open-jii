import { Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import type { CachePort as MacroCachePort } from "../../../macros/core/ports/cache.port";
import type { CachePort as MetricsCachePort } from "../../../metrics/core/ports/cache.port";

export interface CacheNamespace {
  prefix: string;
  ttlMs: number;
}

/**
 * Infrastructure adapter that implements the domain cache ports by delegating
 * to the NestJS cache-manager (in-memory / Redis).
 *
 * Owns key-prefixing, TTL, and the full read-through pattern so domain code
 * never touches cache primitives directly. Each domain registers its own
 * instance with its own key prefix and TTL via a factory provider.
 */
export class CacheAdapter implements MacroCachePort, MetricsCachePort {
  private readonly logger = new Logger(CacheAdapter.name);

  constructor(
    private readonly cache: Cache,
    private readonly namespace: CacheNamespace,
  ) {}

  async tryCache<T>(key: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
    const cacheKey = `${this.namespace.prefix}${key}`;

    try {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached !== undefined && cached !== null) {
        return cached;
      }
    } catch (error) {
      this.logger.warn({ msg: "Cache read failed, treating as miss", cacheKey, error });
    }

    const value = await fetchFn();

    if (value !== null && value !== undefined) {
      try {
        await this.cache.set(cacheKey, value, this.namespace.ttlMs);
      } catch (error) {
        this.logger.warn({ msg: "Cache write failed", cacheKey, error });
      }
    }

    return value;
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
