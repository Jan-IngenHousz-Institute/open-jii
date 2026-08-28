import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

import { TestHarness } from "../../../test/test-harness";
import { MetricsCacheAdapter } from "./metrics-cache.adapter";

describe("MetricsCacheAdapter", () => {
  const testApp = TestHarness.App;
  let cacheAdapter: MetricsCacheAdapter;
  let cacheManager: Cache;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    cacheAdapter = testApp.module.get(MetricsCacheAdapter);
    cacheManager = testApp.module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("tryCache", () => {
    it("calls fetchFn and stores the result under the metrics namespace on a miss", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 5 });

      const result = await cacheAdapter.tryCache("miss-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 5 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(await cacheManager.get("metrics:miss-key")).toEqual({ registeredUsers: 5 });
    });

    it("returns the cached value without calling fetchFn on a hit", async () => {
      await cacheManager.set("metrics:hit-key", { registeredUsers: 7 });
      const fetchFn = vi.fn();

      const result = await cacheAdapter.tryCache("hit-key", fetchFn);

      expect(result).toEqual({ registeredUsers: 7 });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("does not cache a null fetch result", async () => {
      const fetchFn = vi.fn().mockResolvedValue(null);

      const result = await cacheAdapter.tryCache("null-key", fetchFn);

      expect(result).toBeNull();
      expect(await cacheManager.get("metrics:null-key")).toBeUndefined();
    });
  });

  describe("invalidate", () => {
    it("removes the entry so the next read fetches again", async () => {
      await cacheManager.set("metrics:inv-key", { registeredUsers: 7 });

      await cacheAdapter.invalidate("inv-key");

      const fetchFn = vi.fn().mockResolvedValue({ registeredUsers: 9 });
      const result = await cacheAdapter.tryCache("inv-key", fetchFn);
      expect(result).toEqual({ registeredUsers: 9 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
