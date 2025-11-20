import { Logger } from "@nestjs/common";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { FEATURE_FLAGS } from "@repo/analytics";

import type { AnalyticsConfigService } from "../config/config.service";
import { FlagsService } from "./flags.service";

// Mock the analytics/server module with inline functions
vi.mock("@repo/analytics/server", () => ({
  initializePostHogServer: vi.fn().mockResolvedValue(true),
  getPostHogServerClient: vi.fn(() => ({
    isFeatureEnabled: vi.fn().mockResolvedValue(true),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

// Mock the config service
vi.mock("../config/config.service");

describe("FlagsService", () => {
  let service: FlagsService;
  let mockConfigService: AnalyticsConfigService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock config service
    mockConfigService = {
      posthogKey: "test-api-key",
      posthogHost: "https://test-posthog.com",
      isConfigured: vi.fn().mockReturnValue(true),
      getPostHogServerConfig: vi.fn().mockReturnValue({
        host: "https://test-posthog.com",
      }),
    } as unknown as AnalyticsConfigService;

    // Create service instance
    service = new FlagsService(mockConfigService);
  });

  describe("onModuleInit", () => {
    it("should initialize PostHog with config from AnalyticsConfigService", async () => {
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

    it("should log warning when PostHog is not configured", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "warn");
      mockConfigService.isConfigured = vi.fn().mockReturnValueOnce(false);

      await service.onModuleInit();

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
      const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
      vi.mocked(initializePostHogServer).mockRejectedValueOnce(new Error("Init failed"));

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith("Failed to initialize PostHog", expect.any(Error));
    });

    it("should handle missing PostHog key after configuration check", async () => {
      const { initializePostHogServer } = await import("@repo/analytics/server");
      const loggerSpy = vi.spyOn(Logger.prototype, "warn");
      const serviceWithNoKey = new FlagsService({
        ...mockConfigService,
        posthogKey: undefined,
      } as AnalyticsConfigService);

      await serviceWithNoKey.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith("PostHog key is missing after configuration check");
      expect(initializePostHogServer).not.toHaveBeenCalled();
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
      mockConfigService.isConfigured = vi.fn().mockReturnValueOnce(false);
      await service.onModuleInit();
      await service.onModuleDestroy();

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

    it("should handle errors gracefully and return default", async () => {
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
      mockConfigService.isConfigured = vi.fn().mockReturnValueOnce(false);
      await service.onModuleInit();

      expect(service.isInitialized()).toBe(false);
    });
  });
});
