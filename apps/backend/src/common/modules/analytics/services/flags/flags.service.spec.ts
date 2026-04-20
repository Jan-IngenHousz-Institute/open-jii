import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";

import { TestHarness } from "../../../../../test/test-harness";
import { AnalyticsConfigService } from "../config/config.service";
import { FlagsService } from "./flags.service";

describe("FlagsService", () => {
  const testApp = TestHarness.App;
  let service: FlagsService;
  let configService: AnalyticsConfigService;

  // Spy references — recreated fresh in each beforeEach
  let mockInitializePostHogServer: ReturnType<typeof vi.spyOn>;
  let mockGetPostHogServerClient: ReturnType<typeof vi.spyOn>;
  let mockShutdownPostHog: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(FlagsService);
    configService = testApp.module.get(AnalyticsConfigService);

    // Create fresh spies on the protected wrapper methods
    mockInitializePostHogServer = vi
      .spyOn(service as any, "initializePostHog")
      .mockResolvedValue(true);
    mockGetPostHogServerClient = vi.spyOn(service as any, "getPostHogClient").mockReturnValue({
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });
    mockShutdownPostHog = vi
      .spyOn(service as any, "doShutdownPostHog")
      .mockResolvedValue(undefined);
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
      const freshInitSpy = vi.spyOn(freshService as any, "initializePostHog");

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
      const freshInitSpy = vi.spyOn(freshService as any, "initializePostHog");

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
      vi.spyOn(freshService as any, "initializePostHog").mockResolvedValue(false);

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
      vi.spyOn(freshService as any, "initializePostHog").mockRejectedValue(
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
      const freshShutdownSpy = vi.spyOn(freshService as any, "doShutdownPostHog");

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
