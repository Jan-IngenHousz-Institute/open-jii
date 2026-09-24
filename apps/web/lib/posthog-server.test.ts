import { createMyOrganization, createSession } from "@/test/factories";
import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "~/app/actions/auth";

import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

import {
  isFeatureFlagEnabled,
  isFeatureFlagEnabledForViewer,
  shutdownPostHog,
} from "./posthog-server";

// Mock the env module
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_123",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  },
}));

// Mock posthog-node - create mock instance outside so it's consistent
const mockPostHogInstance = {
  isFeatureEnabled: vi.fn(),
  shutdown: vi.fn(),
};

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return mockPostHogInstance;
  }),
}));

const listMyOrganizations = vi.hoisted(() => vi.fn());

vi.mock("./server-orpc", () => ({
  createServerOrpcClient: vi.fn(() => ({ organizations: { listMyOrganizations } })),
}));

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
        { personProperties: undefined },
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
        { personProperties: undefined },
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
      expect(PostHog).toHaveBeenCalledTimes(1);
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
      expect(PostHog).toHaveBeenCalledTimes(1);

      // Shutdown
      await shutdownPostHog();

      // Use again - should create new instance
      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);
      expect(PostHog).toHaveBeenCalledTimes(2);
    });
  });

  describe("isFeatureFlagEnabledForViewer", () => {
    afterEach(() => {
      vi.mocked(auth).mockResolvedValue(null);
      listMyOrganizations.mockReset();
    });

    it("should evaluate a signed-out visitor anonymously", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(false);

      await isFeatureFlagEnabledForViewer(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "anonymous",
        { personProperties: undefined },
      );
      expect(listMyOrganizations).not.toHaveBeenCalled();
    });

    it("should evaluate a signed-in user with their email and memberships", async () => {
      vi.mocked(auth).mockResolvedValue(
        createSession({ user: { id: "user-ana", email: "ana@example.com" } }),
      );
      listMyOrganizations.mockResolvedValue([
        createMyOrganization({ id: "org-qa" }),
        createMyOrganization({ id: "org-lab" }),
      ]);
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureFlagEnabledForViewer(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(result).toBe(true);
      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "ana@example.com",
        { personProperties: { email: "ana@example.com", organization_ids: "org-qa,org-lab" } },
      );
    });

    it("should still evaluate the user when their memberships cannot be read", async () => {
      vi.mocked(auth).mockResolvedValue(
        createSession({ user: { id: "user-ana", email: "ana@example.com" } }),
      );
      listMyOrganizations.mockRejectedValue(new Error("backend unavailable"));
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(false);

      await isFeatureFlagEnabledForViewer(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.MULTI_LANGUAGE,
        "ana@example.com",
        { personProperties: { email: "ana@example.com", organization_ids: "" } },
      );
    });
  });

  describe("PostHog client initialization", () => {
    it("should initialize PostHog with correct config", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureFlagEnabled(FEATURE_FLAGS.MULTI_LANGUAGE);

      expect(PostHog).toHaveBeenCalledWith("phc_test_key_123", {
        host: "https://eu.i.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
      });
    });
  });
});
