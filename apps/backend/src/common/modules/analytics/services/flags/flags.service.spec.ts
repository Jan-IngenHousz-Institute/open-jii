/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS } from "@repo/analytics";
import * as AnalyticsServer from "@repo/analytics/server";

import { TestHarness } from "../../../../../test/test-harness";
import { AnalyticsConfigService } from "../config/config.service";
import { FlagsService } from "./flags.service";

type PostHogServerClient = NonNullable<ReturnType<typeof AnalyticsServer.getPostHogServerClient>>;

describe("FlagsService", () => {
  const testApp = TestHarness.App;
  let service: FlagsService;
  let configService: AnalyticsConfigService;
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

    // Create fresh spies for each test
    mockInitializePostHogServer = vi
      .spyOn(AnalyticsServer, "initializePostHogServer")
      .mockResolvedValue(true);
    mockGetPostHogServerClient = vi
      .spyOn(AnalyticsServer, "getPostHogServerClient")
      .mockReturnValue({
        isFeatureEnabled: vi.fn().mockResolvedValue(true),
        shutdown: vi.fn().mockResolvedValue(undefined),
      } satisfies PostHogServerClient);
    mockShutdownPostHog = vi.spyOn(AnalyticsServer, "shutdownPostHog").mockResolvedValue(undefined);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
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
      // Create a fresh service with mocked config for this test
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(false),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);

      await freshService.onModuleInit();

      expect(mockInitializePostHogServer).not.toHaveBeenCalled();
      expect(freshService.isInitialized()).toBe(false);
    });

    it("should handle missing PostHog key", async () => {
      // Create a fresh service with mocked config for this test
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(true),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);

      await freshService.onModuleInit();

      expect(mockInitializePostHogServer).not.toHaveBeenCalled();
      expect(freshService.isInitialized()).toBe(false);
    });

    it("should handle initialization failure", async () => {
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(true),
        posthogKey: "test-key",
        getPostHogServerConfig: vi.fn().mockReturnValue({ host: "test" }),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);
      mockInitializePostHogServer.mockResolvedValue(false);

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
      mockInitializePostHogServer.mockRejectedValue(new Error("Network error"));

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
      // Create a fresh service that won't be initialized
      const mockConfig = {
        isConfigured: vi.fn().mockReturnValue(false),
        posthogKey: undefined,
        getPostHogServerConfig: vi.fn(),
      } as unknown as AnalyticsConfigService;
      const freshService = new FlagsService(mockConfig);

      // Clear mocks to ensure we only see calls from this test
      mockShutdownPostHog.mockClear();

      await freshService.onModuleInit();
      await freshService.onModuleDestroy();

      expect(mockShutdownPostHog).not.toHaveBeenCalled();
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
