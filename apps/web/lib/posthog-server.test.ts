import { PostHog } from "posthog-node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

import { isFeatureFlagEnabled, shutdownPostHog } from "./posthog-server";

// Mock the env module
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_123",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  },
}));

// Mock posthog-node completely
vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn(),
  };
});

// Get the mocked constructor
const MockedPostHog = vi.mocked(PostHog);

// Create mock functions
const mockIsFeatureEnabled = vi.fn();
const mockShutdown = vi.fn();

// Set up the mock implementation using a proper constructor function
MockedPostHog.mockImplementation(function MockPostHogInstance() {
  return {
    isFeatureEnabled: mockIsFeatureEnabled,
    shutdown: mockShutdown,
  };
});

// Create interface for tests
const mockPostHogInstance = {
  isFeatureEnabled: mockIsFeatureEnabled,
  shutdown: mockShutdown,
};

describe("posthog-server", () => {
  beforeEach(async () => {
    // Reset the singleton by shutting down first
    await shutdownPostHog();

    // Clear all mock calls
    vi.clearAllMocks();
  });

  describe("isFeatureFlagEnabled", () => {
    it("should return true when feature flag is enabled", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(true);
      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "anonymous",
      );
    });

    it("should return false when feature flag is disabled", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(false);
    });

    it("should use custom distinctId when provided", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE, "user123");

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "user123",
      );
    });

    it("should return default value when PostHog returns undefined", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(undefined);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MULTI_LANGUAGE]);
    });

    it("should return default value when PostHog returns null", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(null);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MULTI_LANGUAGE]);
    });

    it("should return default value when PostHog key is not configured", async () => {
      // Reset modules and mock env with no key
      vi.resetModules();
      vi.doMock("~/env", () => ({
        env: {
          NEXT_PUBLIC_POSTHOG_KEY: undefined,
          NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
        },
      }));

      const { isFeatureFlagEnabled: isFeatureFlagEnabledNoKey } = await import("./posthog-server");
      const result = await isFeatureFlagEnabledNoKey(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MULTI_LANGUAGE]);
      expect(mockPostHogInstance.isFeatureEnabled).not.toHaveBeenCalled();

      // Clean up
      vi.doUnmock("~/env");
      vi.resetModules();
    });

    it("should return default value when PostHog key is a placeholder", async () => {
      // Reset modules and mock env with placeholder key
      vi.resetModules();
      vi.doMock("~/env", () => ({
        env: {
          NEXT_PUBLIC_POSTHOG_KEY: "phc_0000",
          NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
        },
      }));

      const { isFeatureFlagEnabled: isFeatureFlagEnabledPlaceholder } = await import(
        "./posthog-server"
      );
      const result = await isFeatureFlagEnabledPlaceholder(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MULTI_LANGUAGE]);
      expect(mockPostHogInstance.isFeatureEnabled).not.toHaveBeenCalled();

      // Clean up
      vi.doUnmock("~/env");
      vi.resetModules();
    });
    it("should return default value and log error when PostHog throws", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new Error("PostHog API error");
      mockPostHogInstance.isFeatureEnabled.mockRejectedValue(error);

      const result = await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MULTI_LANGUAGE]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[PostHog] Error checking feature flag ${FEATURE_FLAGS.MULTI_LANGUAGE}:`,
        error,
      );

      consoleErrorSpy.mockRestore();
    });

    it("should reuse singleton PostHog instance across multiple calls", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // PostHog constructor should only be called once (singleton)
      expect(MockedPostHog).toHaveBeenCalledTimes(1);
      // But isFeatureEnabled should be called three times
      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledTimes(3);
    });
  });

  describe("shutdownPostHog", () => {
    it("should shutdown PostHog client when it exists", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      // Create the client by calling isFeatureFlagEnabled
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      // Now shutdown
      await shutdownPostHog();

      expect(mockPostHogInstance.shutdown).toHaveBeenCalledTimes(1);
    });

    it("should handle shutdown when client does not exist", async () => {
      // Don't create a client, just shutdown
      await shutdownPostHog();

      // Should not throw and shutdown should not be called
      expect(mockPostHogInstance.shutdown).not.toHaveBeenCalled();
    });

    it("should allow creating new client after shutdown", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      // Create and use client
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      expect(MockedPostHog).toHaveBeenCalledTimes(1);

      // Shutdown
      await shutdownPostHog();

      // Use again - should create new instance
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      expect(MockedPostHog).toHaveBeenCalledTimes(2);
    });
  });

  describe("PostHog client initialization", () => {
    it("should initialize PostHog with correct config", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(MockedPostHog).toHaveBeenCalledWith("phc_test_key_123", {
        host: "https://eu.i.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
      });
    });
  });
});
