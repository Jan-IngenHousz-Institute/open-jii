import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import { CachePort } from "../../../metrics/core/ports/cache.port";

const PREFIX = "metrics:";
// Matches the pipeline cadence: a shorter TTL would re-query the warehouse
// for data that cannot have changed yet.
const TTL_MS = 10 * 60 * 1000;

/**
 * Infrastructure adapter that implements the metrics CachePort by delegating
 * to the NestJS cache-manager, mirroring the macro CacheAdapter with its own
 * key namespace and a TTL matched to the metrics pipeline refresh.
 */
@Injectable()
export class MetricsCacheAdapter extends CachePort {
  private readonly logger = new Logger(MetricsCacheAdapter.name);

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

  async invalidate(key: string): Promise<void> {
    try {
      await this.cache.del(`${PREFIX}${key}`);
    } catch (error) {
      this.logger.warn({ msg: "Cache invalidation failed", key, error });
    }
  }
}
