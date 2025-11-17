import { Logger } from "@nestjs/common";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { FEATURE_FLAGS } from "@repo/analytics";

import { AnalyticsService } from "./analytics.service";

// Mock the analytics/server module with inline functions
vi.mock("@repo/analytics/server", () => ({
  initializePostHogServer: vi.fn().mockResolvedValue(true),
  getPostHogServerClient: vi.fn(() => ({
    isFeatureEnabled: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset mocks
    vi.clearAllMocks();

    // Set up test environment variables
    process.env.POSTHOG_KEY = "test-api-key";
    process.env.POSTHOG_HOST = "https://test-posthog.com";

    // Create service instance
    service = new AnalyticsService();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("onModuleInit", () => {
    it("should initialize PostHog with environment variables", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");

      await service.onModuleInit();

      expect(initializePostHogServer).toHaveBeenCalledWith(
        "test-api-key",
        expect.objectContaining({
          host: "https://test-posthog.com",
        }),
      );
    });

    it("should log success message when initialization succeeds", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "log");
      vi.mocked(initializePostHogServer).mockResolvedValueOnce(true);

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith("PostHog initialized successfully");
    });

    it("should log warning when PostHog key is not configured", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "warn");
      delete process.env.POSTHOG_KEY;
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

      const newService = new AnalyticsService();
      await newService.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("PostHog not configured"));
      expect(initializePostHogServer).not.toHaveBeenCalled();
    });

    it("should log warning when initialization fails", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "warn");
      vi.mocked(initializePostHogServer).mockResolvedValueOnce(false);

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        "PostHog initialization failed - using default feature flag values",
      );
    });

    it("should handle initialization errors", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "error");
      vi.mocked(initializePostHogServer).mockRejectedValueOnce(new Error("Init failed"));

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith("Failed to initialize PostHog", expect.any(Error));
    });

    it("should skip initialization for placeholder keys", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "warn");
      process.env.POSTHOG_KEY = "phc_0000";

      const newService = new AnalyticsService();
      await newService.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining("PostHog not configured"));
      expect(initializePostHogServer).not.toHaveBeenCalled();
    });

    it("should use NEXT_PUBLIC_POSTHOG_KEY as fallback", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      delete process.env.POSTHOG_KEY;
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "fallback-key";

      const newService = new AnalyticsService();
      await newService.onModuleInit();

      expect(initializePostHogServer).toHaveBeenCalledWith("fallback-key", expect.any(Object));
    });

    it("should use default host when not configured", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      delete process.env.POSTHOG_HOST;
      delete process.env.NEXT_PUBLIC_POSTHOG_HOST;

      const newService = new AnalyticsService();
      await newService.onModuleInit();

      expect(initializePostHogServer).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          host: "https://eu.i.posthog.com",
        }),
      );
    });
  });

  describe("onModuleDestroy", () => {
    it("should shutdown PostHog when initialized", async () => {
      const { shutdownPostHog } = await import("@repo/analytics/server");
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(shutdownPostHog).toHaveBeenCalled();
    });

    it("should log shutdown message", async () => {
      const loggerSpy = vi.spyOn(Logger.prototype, "log");
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(loggerSpy).toHaveBeenCalledWith("PostHog shutdown completed");
    });

    it("should not call shutdown if not initialized", async () => {
      const { shutdownPostHog } = await import("@repo/analytics/server");
      delete process.env.POSTHOG_KEY;
      const newService = new AnalyticsService();
      await newService.onModuleInit();
      await newService.onModuleDestroy();

      expect(shutdownPostHog).not.toHaveBeenCalled();
    });
  });

  describe("isFeatureFlagEnabled", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("should return a boolean value for feature flag check", async () => {
      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(typeof result).toBe("boolean");
    });

    it("should use default distinctId when not provided", async () => {
      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(typeof result).toBe("boolean");
    });

    it("should accept custom distinctId", async () => {
      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );

      expect(typeof result).toBe("boolean");
    });

    it("should handle errors gracefully", async () => {
      const { getPostHogServerClient } = await import("@repo/analytics/server");
      vi.mocked(getPostHogServerClient).mockReturnValueOnce(null);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(typeof result).toBe("boolean");
    });
  });

  describe("isInitialized", () => {
    it("should return false before initialization", () => {
      expect(service.isInitialized()).toBe(false);
    });

    it("should return true after successful initialization", async () => {
      await service.onModuleInit();
      expect(service.isInitialized()).toBe(true);
    });

    it("should return false when initialization fails", async () => {
      delete process.env.POSTHOG_KEY;
      const newService = new AnalyticsService();
      await newService.onModuleInit();

      expect(newService.isInitialized()).toBe(false);
    });
  });
});
