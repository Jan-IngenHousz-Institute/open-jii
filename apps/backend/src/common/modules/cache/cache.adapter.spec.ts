import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

import type { CachePort as MacroCachePort } from "../../../macros/core/ports/cache.port";
import { CACHE_PORT as MACRO_CACHE_PORT } from "../../../macros/core/ports/cache.port";
import type { CachePort as MetricsCachePort } from "../../../metrics/core/ports/cache.port";
import { CACHE_PORT as METRICS_CACHE_PORT } from "../../../metrics/core/ports/cache.port";
import { TestHarness } from "../../../test/test-harness";
import { CacheAdapter } from "./cache.adapter";

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

    it("loads once for every caller that arrives while the load is running", async () => {
      let started = 0;
      let release: (() => void) | undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });

      const fetchFn = vi.fn(async () => {
        started += 1;
        await held;
        return "warehouse";
      });

      const callers = [
        cacheAdapter.tryCache("cold", fetchFn),
        cacheAdapter.tryCache("cold", fetchFn),
        cacheAdapter.tryCache("cold", fetchFn),
      ];

      release?.();
      const results = await Promise.all(callers);

      // One warehouse read, three satisfied callers.
      expect(started).toBe(1);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(results).toEqual(["warehouse", "warehouse", "warehouse"]);
    });

    it("gives every concurrent caller the value even when the cache write fails", async () => {
      vi.spyOn(cacheManager, "set").mockRejectedValue(new Error("store down"));
      const fetchFn = vi.fn().mockResolvedValue("warehouse");

      const results = await Promise.all([
        cacheAdapter.tryCache("unwritable", fetchFn),
        cacheAdapter.tryCache("unwritable", fetchFn),
        cacheAdapter.tryCache("unwritable", fetchFn),
      ]);

      // Nothing was stored to read back, so waiters take the load's own result.
      expect(results).toEqual(["warehouse", "warehouse", "warehouse"]);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("lets the next caller load again once the first has finished", async () => {
      const fetchFn = vi.fn().mockResolvedValue("warehouse");

      await cacheAdapter.tryCache("sequential", fetchFn);
      await cacheManager.del("macro:sequential");
      await cacheAdapter.tryCache("sequential", fetchFn);

      // Deduplication lasts for the load, not beyond it.
      expect(fetchFn).toHaveBeenCalledTimes(2);
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

    it("stores results under the metrics prefix, with the moment they stop being fresh", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 5 });

      const result = await metricsCache.tryCache("miss-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 5 });
      const stored = await cacheManager.get<{ value: unknown; freshUntil: unknown }>(
        "metrics:miss-key",
      );
      expect(stored?.value).toEqual({ registeredUsers: 5 });
      expect(typeof stored?.freshUntil).toBe("number");
      expect(await cacheManager.get("macro:miss-key")).toBeUndefined();
    });

    it("returns a fresh value without calling fetchFn", async () => {
      await cacheManager.set("metrics:hit-key", {
        value: { registeredUsers: 7 },
        freshUntil: Date.now() + 60_000,
      });
      const fetchFn = vi.fn();

      const result = await metricsCache.tryCache("hit-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 7 });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("invalidates so the next read fetches again", async () => {
      await cacheManager.set("metrics:inv-key", {
        value: { registeredUsers: 7 },
        freshUntil: Date.now() + 60_000,
      });

      await metricsCache.invalidate("inv-key");

      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 9 });
      const result = await metricsCache.tryCache("inv-key", fetchFn);
      expect(result).toEqual({ registeredUsers: 9 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("stale while revalidate", () => {
    // Fresh for one millisecond, servable for a minute, callers wait 50ms.
    const namespace = { prefix: "swr:", ttlMs: 1, staleMs: 60_000, waitMs: 50 };
    let adapter: CacheAdapter;

    const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 5));

    beforeEach(() => {
      adapter = new CacheAdapter(cacheManager, namespace);
    });

    it("serves a stale value at once and refreshes it behind the reply", async () => {
      await cacheManager.set("swr:stale", { value: "old", freshUntil: Date.now() - 1 }, 60_000);
      const fetchFn = vi.fn().mockResolvedValue("new");

      const served = await adapter.tryCache("stale", fetchFn);

      // The caller got the old figure without waiting on the source.
      expect(served).toBe("old");
      expect(fetchFn).toHaveBeenCalledTimes(1);

      await settle();
      expect(await cacheManager.get("swr:stale")).toMatchObject({ value: "new" });
    });

    it("keeps serving stale when the refresh fails, rather than nothing", async () => {
      await cacheManager.set("swr:failing", { value: "old", freshUntil: Date.now() - 1 }, 60_000);
      const fetchFn = vi.fn().mockRejectedValue(new Error("warehouse asleep"));

      await expect(adapter.tryCache("failing", fetchFn)).resolves.toBe("old");

      await settle();
      expect(await cacheManager.get("swr:failing")).toMatchObject({ value: "old" });
    });

    it("gives a caller with nothing to serve null after the wait, and finishes the load anyway", async () => {
      // Fresh long enough for the final read to find it fresh, not merely servable.
      const adapter = new CacheAdapter(cacheManager, { ...namespace, ttlMs: 60_000 });
      let release: (() => void) | undefined;
      const fetchFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve("late");
          }),
      );

      const first = await adapter.tryCache("slow", fetchFn);
      expect(first).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // The source answers after the caller gave up; the answer is not thrown away.
      release?.();
      await settle();
      expect(await cacheManager.get("swr:slow")).toMatchObject({ value: "late" });

      // With a fresh value now stored, the next caller is served without a load.
      expect(await adapter.tryCache("slow", fetchFn)).toBe("late");
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("drops the result of a load that was invalidated while running", async () => {
      let release: (() => void) | undefined;
      const fetchFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve("from before");
          }),
      );

      const pending = adapter.tryCache("edited", fetchFn);
      // Invalidate once the load is actually running, not before it starts.
      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
      await adapter.invalidate("edited");
      release?.();

      // The waiting caller still gets the source's answer.
      expect(await pending).toBe("from before");
      await settle();
      // The cache does not, or the invalidation would be undone.
      expect(await cacheManager.get("swr:edited")).toBeUndefined();
    });

    it("starts a fresh load for a caller arriving after an invalidation", async () => {
      let release: (() => void) | undefined;
      const fetchFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve("value");
          }),
      );

      const first = adapter.tryCache("reissued", fetchFn);
      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
      await adapter.invalidate("reissued");
      const second = adapter.tryCache("reissued", fetchFn);

      await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
      release?.();
      await Promise.all([first, second]);
    });

    it("runs one load for a stale key however many callers arrive while it is stale", async () => {
      await cacheManager.set("swr:shared", { value: "old", freshUntil: Date.now() - 1 }, 60_000);
      let release: (() => void) | undefined;
      const fetchFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve("new");
          }),
      );

      const served = await Promise.all([
        adapter.tryCache("shared", fetchFn),
        adapter.tryCache("shared", fetchFn),
        adapter.tryCache("shared", fetchFn),
      ]);

      expect(served).toEqual(["old", "old", "old"]);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      release?.();
    });
  });
});
