import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

import type { CachePort as MacroCachePort } from "../../../macros/core/ports/cache.port";
import { CACHE_PORT as MACRO_CACHE_PORT } from "../../../macros/core/ports/cache.port";
import type { CachePort as MetricsCachePort } from "../../../metrics/core/ports/cache.port";
import { CACHE_PORT as METRICS_CACHE_PORT } from "../../../metrics/core/ports/cache.port";
import { TestHarness } from "../../../test/test-harness";

describe("CacheAdapter", () => {
  const testApp = TestHarness.App;
  let cacheAdapter: MacroCachePort;
  let cacheManager: Cache;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    cacheAdapter = testApp.module.get<MacroCachePort>(MACRO_CACHE_PORT);
    cacheManager = testApp.module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("tryCache", () => {
    it("should call fetchFn and cache the result on a cache miss", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ id: "1", name: "Test" });

      const result = await cacheAdapter.tryCache("key-1", fetchFn);

      expect(result).toEqual({ id: "1", name: "Test" });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Verify value was stored in cache with the prefixed key
      const cached = await cacheManager.get("macro:key-1");
      expect(cached).toEqual({ id: "1", name: "Test" });
    });

    it("should return cached value without calling fetchFn on a cache hit", async () => {
      // Pre-populate cache
      await cacheManager.set("macro:key-2", { id: "2", name: "Cached" });

      const fetchFn = vi.fn();

      const result = await cacheAdapter.tryCache("key-2", fetchFn);

      expect(result).toEqual({ id: "2", name: "Cached" });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("should return null and not cache when fetchFn returns null", async () => {
      const fetchFn = vi.fn().mockResolvedValue(null);

      const result = await cacheAdapter.tryCache("missing-key", fetchFn);

      expect(result).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Verify nothing was cached
      const cached = await cacheManager.get("macro:missing-key");
      expect(cached).toBeUndefined();
    });

    it("should use the 'macro:' prefix for cache keys", async () => {
      const getSpy = vi.spyOn(cacheManager, "get");
      const setSpy = vi.spyOn(cacheManager, "set");
      const fetchFn = vi.fn().mockResolvedValue("value");

      await cacheAdapter.tryCache("my-key", fetchFn);

      expect(getSpy).toHaveBeenCalledWith("macro:my-key");
      expect(setSpy).toHaveBeenCalledWith("macro:my-key", "value", 5 * 60 * 1000);
    });
  });

  describe("tryCacheMany", () => {
    it("should fetch all keys on a complete cache miss", async () => {
      const fetchFn = vi.fn().mockResolvedValue(
        new Map([
          ["a", { id: "a", name: "A" }],
          ["b", { id: "b", name: "B" }],
        ]),
      );

      const result = await cacheAdapter.tryCacheMany(["a", "b"], fetchFn);

      expect(result.size).toBe(2);
      expect(result.get("a")).toEqual({ id: "a", name: "A" });
      expect(result.get("b")).toEqual({ id: "b", name: "B" });
      expect(fetchFn).toHaveBeenCalledWith(["a", "b"]);

      // Verify values were cached
      expect(await cacheManager.get("macro:a")).toEqual({ id: "a", name: "A" });
      expect(await cacheManager.get("macro:b")).toEqual({ id: "b", name: "B" });
    });

    it("should return all from cache without calling fetchFn on a complete cache hit", async () => {
      // Pre-populate cache
      await cacheManager.set("macro:x", { id: "x", name: "X" });
      await cacheManager.set("macro:y", { id: "y", name: "Y" });

      const fetchFn = vi.fn();

      const result = await cacheAdapter.tryCacheMany(["x", "y"], fetchFn);

      expect(result.size).toBe(2);
      expect(result.get("x")).toEqual({ id: "x", name: "X" });
      expect(result.get("y")).toEqual({ id: "y", name: "Y" });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("should only fetch missed keys on a partial cache hit", async () => {
      // Pre-populate only one key
      await cacheManager.set("macro:cached", { id: "cached", name: "Cached" });

      const fetchFn = vi
        .fn()
        .mockResolvedValue(new Map([["missed", { id: "missed", name: "Missed" }]]));

      const result = await cacheAdapter.tryCacheMany(["cached", "missed"], fetchFn);

      expect(result.size).toBe(2);
      expect(result.get("cached")).toEqual({ id: "cached", name: "Cached" });
      expect(result.get("missed")).toEqual({ id: "missed", name: "Missed" });

      // fetchFn should only receive the missed key
      expect(fetchFn).toHaveBeenCalledWith(["missed"]);
    });

    it("should handle an empty keys array without calling fetchFn", async () => {
      const fetchFn = vi.fn();

      const result = await cacheAdapter.tryCacheMany([], fetchFn);

      expect(result.size).toBe(0);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    it("should remove the cached entry for the given key", async () => {
      // Pre-populate cache
      await cacheManager.set("macro:to-delete", { id: "1" });
      expect(await cacheManager.get("macro:to-delete")).toBeDefined();

      await cacheAdapter.invalidate("to-delete");

      expect(await cacheManager.get("macro:to-delete")).toBeUndefined();
    });

    it("should not throw when invalidating a non-existent key", async () => {
      await expect(cacheAdapter.invalidate("non-existent")).resolves.toBeUndefined();
    });
  });

  describe("storage failures", () => {
    it("treats a failed read as a miss and still serves the fetched value", async () => {
      vi.spyOn(cacheManager, "get").mockRejectedValueOnce(new Error("store down"));
      const fetchFn = vi.fn().mockResolvedValue({ id: "1" });

      const result = await cacheAdapter.tryCache("bad-read", fetchFn);

      expect(result).toEqual({ id: "1" });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("returns the fetched value even when the write fails", async () => {
      vi.spyOn(cacheManager, "set").mockRejectedValueOnce(new Error("store down"));
      const fetchFn = vi.fn().mockResolvedValue({ id: "2" });

      const result = await cacheAdapter.tryCache("bad-write", fetchFn);

      expect(result).toEqual({ id: "2" });
    });

    it("treats failed batch reads as misses and survives failed batch writes", async () => {
      vi.spyOn(cacheManager, "get").mockRejectedValue(new Error("store down"));
      vi.spyOn(cacheManager, "set").mockRejectedValue(new Error("store down"));
      const fetchFn = vi.fn().mockResolvedValue(new Map([["k1", "v1"]]));

      const result = await cacheAdapter.tryCacheMany(["k1"], fetchFn);

      expect(result.get("k1")).toBe("v1");
      expect(fetchFn).toHaveBeenCalledWith(["k1"]);
    });

    it("does not throw when invalidation fails", async () => {
      vi.spyOn(cacheManager, "del").mockRejectedValueOnce(new Error("store down"));

      await expect(cacheAdapter.invalidate("whatever")).resolves.toBeUndefined();
    });
  });

  describe("metrics namespace", () => {
    let metricsCache: MetricsCachePort;

    beforeEach(() => {
      metricsCache = testApp.module.get<MetricsCachePort>(METRICS_CACHE_PORT);
    });

    it("stores results under the metrics prefix, separate from the macro namespace", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 5 });

      const result = await metricsCache.tryCache("miss-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 5 });
      expect(await cacheManager.get("metrics:miss-key")).toEqual({ registeredUsers: 5 });
      expect(await cacheManager.get("macro:miss-key")).toBeUndefined();
    });

    it("returns the cached value without calling fetchFn on a hit", async () => {
      await cacheManager.set("metrics:hit-key", { registeredUsers: 7 });
      const fetchFn = vi.fn();

      const result = await metricsCache.tryCache("hit-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 7 });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("invalidates so the next read fetches again", async () => {
      await cacheManager.set("metrics:inv-key", { registeredUsers: 7 });

      await metricsCache.invalidate("inv-key");

      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 9 });
      const result = await metricsCache.tryCache("inv-key", fetchFn);
      expect(result).toEqual({ registeredUsers: 9 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
