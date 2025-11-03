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

      expect(PostHog).toHaveBeenCalledWith(
        "test-key",
        expect.objectContaining({
          host: "https://test.posthog.com",
        }),
      );
    });
  });

  describe("isFeatureFlagEnabled", () => {
    it("should return true when feature flag is enabled", async () => {
      const client = getPostHogClient();
      const isFeatureFlagEnabledSpy = vi.spyOn(client, "isFeatureEnabled").mockResolvedValue(true);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(true);
      expect(isFeatureFlagEnabledSpy).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "anonymous",
      );
    });

    it("should return false when feature flag is disabled", async () => {
      const client = getPostHogClient();
      vi.spyOn(client, "isFeatureEnabled").mockResolvedValue(false);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
    });

    it("should return false when feature flag returns undefined", async () => {
      const client = getPostHogClient();
      vi.spyOn(client, "isFeatureEnabled").mockResolvedValue(undefined);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
    });

    it("should use custom distinctId when provided", async () => {
      const client = getPostHogClient();
      const isFeatureFlagEnabledSpy = vi.spyOn(client, "isFeatureEnabled").mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE, "user-123");

      expect(isFeatureFlagEnabledSpy).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "user-123",
      );
    });

    it("should return false and log error when PostHog fails", async () => {
      const client = getPostHogClient();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(client, "isFeatureEnabled").mockRejectedValue(new Error("PostHog error"));

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[PostHog Server] Error checking feature flag multi-language:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("shutdownPostHog", () => {
    it("should shutdown the PostHog client", async () => {
      const client = getPostHogClient();
      const shutdownSpy = vi.spyOn(client, "shutdown");

      await shutdownPostHog();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it("should handle multiple shutdown calls gracefully", async () => {
      const client = getPostHogClient();
      const shutdownSpy = vi.spyOn(client, "shutdown");

      await shutdownPostHog();
      await shutdownPostHog();

      expect(shutdownSpy).toHaveBeenCalledTimes(1);
    });
  });
});
