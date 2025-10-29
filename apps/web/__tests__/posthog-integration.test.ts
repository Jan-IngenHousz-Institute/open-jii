/**
 * Integration test for PostHog feature flag system
 * Tests the full flow from client to server
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { FEATURE_FLAGS } from "../lib/posthog-config";
import {
  clearFeatureFlagCache,
  getCircuitBreakerState,
  isFeatureFlagEnabled,
  setTestFeatureFlag,
  setTestMode,
  shutdownPostHog,
} from "../lib/posthog-server";

describe("PostHog Integration Tests", () => {
  beforeAll(() => {
    setTestMode(true);
  });

  afterAll(async () => {
    setTestMode(false);
    await shutdownPostHog();
  });

  describe("Feature Flag Flow", () => {
    it("should respect default values when flag is not set", async () => {
      clearFeatureFlagCache();

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // Should use default from config (false)
      expect(result).toBe(false);
    });

    it("should use test override when set", async () => {
      clearFeatureFlagCache();
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(true);
    });

    it("should cache feature flag results", async () => {
      clearFeatureFlagCache();
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      // First call
      const result1 = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // Change test value
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, false);

      // Second call should use cached value (true)
      const result2 = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result1).toBe(true);
      expect(result2).toBe(true); // Still true from cache

      // After clearing cache
      clearFeatureFlagCache();
      const result3 = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      expect(result3).toBe(false); // New value
    });

    it("should handle different distinctIds separately", async () => {
      clearFeatureFlagCache();
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      const user1Result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE, "user-1");
      const user2Result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE, "user-2");
      const anonResult = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // All should get the same value in test mode
      expect(user1Result).toBe(true);
      expect(user2Result).toBe(true);
      expect(anonResult).toBe(true);
    });
  });

  describe("Circuit Breaker", () => {
    it("should start in CLOSED state", () => {
      const state = getCircuitBreakerState();
      expect(state).toBe("CLOSED");
    });

    it("should maintain state across multiple successful calls", async () => {
      clearFeatureFlagCache();
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      const state = getCircuitBreakerState();
      expect(state).toBe("CLOSED");
    });
  });

  describe("Type Safety", () => {
    it("should only accept valid feature flag keys", async () => {
      // This should compile
      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      expect(typeof result).toBe("boolean");

      // This should NOT compile (uncomment to test)
      // const invalid = await isFeatureFlagEnabled("invalid-key");
    });
  });

  describe("Performance", () => {
    it("should complete cache lookups in <1ms", async () => {
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      // Warm up cache
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // Measure cached lookup
      const start = performance.now();
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it("should handle high concurrency", async () => {
      clearFeatureFlagCache();
      setTestFeatureFlag(FEATURE_FLAGS.MULTI_LANGUAGE, true);

      // Simulate 100 concurrent requests
      const promises = Array.from({ length: 100 }, () =>
        isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE),
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(100);
      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should fallback to default on error", async () => {
      clearFeatureFlagCache();
      setTestMode(false); // Disable test mode to trigger potential errors

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // Should use conservative default (false)
      expect(result).toBe(false);

      setTestMode(true); // Re-enable
    });
  });
});
