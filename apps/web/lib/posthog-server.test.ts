import { PostHog } from "posthog-node";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { FEATURE_FLAGS } from "./posthog-config";
import {
  getPostHogClient,
  isFeatureFlagEnabled,
  shutdownPostHog,
  clearFeatureFlagCache,
} from "./posthog-server";

// Mock the PostHog module
vi.mock("posthog-node", () => {
  const mockIsFeatureEnabled = vi.fn();
  const mockShutdown = vi.fn();

  return {
    PostHog: vi.fn().mockImplementation(() => ({
      isFeatureEnabled: mockIsFeatureEnabled,
      shutdown: mockShutdown,
    })),
  };
});

// Mock the env module
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: "test-key",
    NEXT_PUBLIC_POSTHOG_HOST: "https://test.posthog.com",
  },
}));

describe("posthog-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFeatureFlagCache();
  });

  afterEach(async () => {
    await shutdownPostHog();
    clearFeatureFlagCache();
  });

  describe("getPostHogClient", () => {
    it("should create a PostHog client singleton", () => {
      const client1 = getPostHogClient();
      const client2 = getPostHogClient();

      expect(client1).toBe(client2);
      expect(client1).toBeDefined();
    });

    it("should initialize PostHog with correct config", () => {
      getPostHogClient();

      expect(PostHog).toHaveBeenCalledWith("test-key", {
        host: "https://test.posthog.com",
      });
    });
  });

  describe("isFeatureFlagEnabled", () => {
    it("should return true when feature flag is enabled", async () => {
      const client = getPostHogClient();
      const mockIsFeatureEnabled = vi.mocked(client.isFeatureEnabled);
      mockIsFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(true);
      expect(mockIsFeatureEnabled).toHaveBeenCalledWith(FEATURE_FLAGS.MULTI_LANGUAGE, "anonymous");
    });

    it("should return false when feature flag is disabled", async () => {
      const client = getPostHogClient();
      const mockIsFeatureEnabled = vi.mocked(client.isFeatureEnabled);
      mockIsFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
    });

    it("should return false when feature flag returns undefined", async () => {
      const client = getPostHogClient();
      const mockIsFeatureEnabled = vi.mocked(client.isFeatureEnabled);
      mockIsFeatureEnabled.mockResolvedValue(undefined);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
    });

    it("should use custom distinctId when provided", async () => {
      const client = getPostHogClient();
      const mockIsFeatureEnabled = vi.mocked(client.isFeatureEnabled);
      mockIsFeatureEnabled.mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE, "user-123");

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith(FEATURE_FLAGS.MULTI_LANGUAGE, "user-123");
    });

    it("should return false and log error when PostHog fails", async () => {
      const client = getPostHogClient();
      const mockIsFeatureEnabled = vi.mocked(client.isFeatureEnabled);
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mockIsFeatureEnabled.mockRejectedValue(new Error("PostHog error"));

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[PostHog Server] Error checking feature flag test-flag:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("shutdownPostHog", () => {
    it("should shutdown the PostHog client", async () => {
      const client = getPostHogClient();
      const mockShutdown = vi.mocked(client.shutdown);

      await shutdownPostHog();

      expect(mockShutdown).toHaveBeenCalled();
    });

    it("should handle multiple shutdown calls gracefully", async () => {
      const client = getPostHogClient();
      const mockShutdown = vi.mocked(client.shutdown);

      await shutdownPostHog();
      await shutdownPostHog();

      expect(mockShutdown).toHaveBeenCalledTimes(1);
    });
  });
});
