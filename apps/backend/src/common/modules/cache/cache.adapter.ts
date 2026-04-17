import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import { CachePort } from "../../../macros/core/ports/cache.port";

const PREFIX = "macro:";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Infrastructure adapter that implements the domain CachePort
 * by delegating to the NestJS cache-manager (in-memory / Redis).
 *
 * Owns key-prefixing, TTL, and the full read-through pattern
 * so domain code never touches cache primitives directly.
 */
@Injectable()
export class CacheAdapter extends CachePort {
  private readonly logger = new Logger(CacheAdapter.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {
    super();
  }

  async tryCache<T>(key: string, fetchFn: () => Promise<T | null>): Promise<T | null> {
    const cacheKey = `${PREFIX}${key}`;

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
        await this.cache.set(cacheKey, value, TTL_MS);
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
        const cached = await this.cache.get<T>(`${PREFIX}${key}`);
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
          await this.cache.set(`${PREFIX}${key}`, value, TTL_MS);
        } catch (error) {
          this.logger.warn({ msg: "Cache write failed", key, error });
        }
      }
    }

    return result;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.cache.del(`${PREFIX}${key}`);
    } catch (error) {
      this.logger.warn({ msg: "Cache invalidation failed", key, error });
    }
  }
}
