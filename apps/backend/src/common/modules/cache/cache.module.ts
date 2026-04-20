import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";

import { CacheAdapter } from "./cache.adapter";

/**
 * Shared cache module wrapping @nestjs/cache-manager.
 *
 * Currently uses the in-memory store.  To switch to Redis, swap the
 * register call for `registerAsync` with a `cache-manager-redis-yet` store
 * factory — no consumer code changes required.
 */
@Module({
  imports: [
    NestCacheModule.register({
      ttl: 5 * 60 * 1000, // 5 minutes default TTL (ms)
      max: 500, // max entries in memory
    }),
  ],
  providers: [CacheAdapter],
  exports: [NestCacheModule, CacheAdapter],
})
export class CacheModule {}
