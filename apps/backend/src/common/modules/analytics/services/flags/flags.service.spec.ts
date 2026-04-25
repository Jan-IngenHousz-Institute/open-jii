import type { MockInstance } from "vitest";

import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

import { TestHarness } from "../../../../../test/test-harness";
import { AnalyticsConfigService } from "../config/config.service";
import { FlagsService } from "./flags.service";

// `keyof T` would be tighter but excludes `protected` members, which is the
// whole point of this helper.
function spyOnProtected(instance: object, method: string): MockInstance {
  return vi.spyOn(instance as unknown as Record<string, unknown>, method as never);
}

describe("FlagsService", () => {
  const testApp = TestHarness.App;
  let service: FlagsService;
  let configService: AnalyticsConfigService;

  // Spy references - recreated fresh in each beforeEach
  let mockInitializePostHogServer: MockInstance;
  let mockGetPostHogServerClient: MockInstance;
  let mockShutdownPostHog: MockInstance;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(FlagsService);
    configService = testApp.module.get(AnalyticsConfigService);

    // Create fresh spies on the protected wrapper methods
    mockInitializePostHogServer = spyOnProtected(service, "initializePostHog").mockResolvedValue(
      true,
    );
    mockGetPostHogServerClient = spyOnProtected(service, "getPostHogClient").mockReturnValue({
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });
    mockShutdownPostHog = spyOnProtected(service, "shutdownPostHogClient").mockResolvedValue(undefined);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("onModuleInit", () => {
    it("should initialize successfully when properly configured", async () => {
      vi.spyOn(configService, "isConfigured").mockReturnValue(true);
      vi.spyOn(configService, "posthogKey", "get").mockReturnValue("test-key");
      mockInitializePostHogServer.mockResolvedValue(true);

      await service.onModuleInit();

      expect(service.isInitialized()).toBe(true);
    });

    it("should skip initialization when not configured", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(false),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      const freshInitSpy = spyOnProtected(freshService, "initializePostHog");

      await freshService.onModuleInit();

      expect(freshInitSpy).not.toHaveBeenCalled();
      expect(freshService.isInitialized()).toBe(false);
    });

    it("should handle missing PostHog key", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(true),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      const freshInitSpy = spyOnProtected(freshService, "initializePostHog");

      await freshService.onModuleInit();

      expect(freshInitSpy).not.toHaveBeenCalled();
      expect(freshService.isInitialized()).toBe(false);
    });

    it("should handle initialization failure", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(true),
        posthogKey: "test-key",
        getPostHogServerConfig: vi.fn().mockReturnValue({ host: "test" }),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      spyOnProtected(freshService, "initializePostHog").mockResolvedValue(false);

      await freshService.onModuleInit();

      expect(freshService.isInitialized()).toBe(false);
    });

    it("should handle initialization errors gracefully", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(true),
        posthogKey: "test-key",
        getPostHogServerConfig: vi.fn().mockReturnValue({ host: "test" }),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      spyOnProtected(freshService, "initializePostHog").mockRejectedValue(
        new Error("Network error"),
      );

      await expect(freshService.onModuleInit()).resolves.not.toThrow();
      expect(freshService.isInitialized()).toBe(false);
    });
  });

  describe("onModuleDestroy", () => {
    it("should shutdown when initialized", async () => {
      // First initialize the service
      vi.spyOn(configService, "isConfigured").mockReturnValue(true);
      vi.spyOn(configService, "posthogKey", "get").mockReturnValue("test-key");
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockShutdownPostHog).toHaveBeenCalled();
    });

    it("should not shutdown when not initialized", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(false),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      const freshShutdownSpy = spyOnProtected(freshService, "shutdownPostHogClient");

      await freshService.onModuleInit();
      await freshService.onModuleDestroy();

      expect(freshShutdownSpy).not.toHaveBeenCalled();
    });
  });

  describe("isFeatureFlagEnabled", () => {
    it("should return PostHog result when client is available", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockResolvedValue(true),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(result).toBe(true);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "anonymous",
      );
    });

    it("should return default value when client is null", async () => {
      mockGetPostHogServerClient.mockReturnValue(null);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING]);
    });

    it("should use custom distinctId when provided", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockResolvedValue(false),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );

      expect(result).toBe(false);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
        "user-123",
      );
    });

    it("should return default when PostHog returns null", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockResolvedValue(null),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING]);
    });

    it("should handle errors and return default value", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockRejectedValue(new Error("PostHog error")),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const result = await service.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
      );

      expect(result).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING]);
    });
  });

  describe("isInitialized", () => {
    it("should return a boolean value", () => {
      const result = service.isInitialized();
      expect(typeof result).toBe("boolean");
    });
  });
});
