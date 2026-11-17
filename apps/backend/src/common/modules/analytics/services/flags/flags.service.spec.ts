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
    configService = testApp.module.get(AnalyticsConfigService);
    // The module's instance lives as long as the file, and a failure pauses it for every test after.
    service = new FlagsService(configService);

    // Create fresh spies on the protected wrapper methods
    mockInitializePostHogServer = spyOnProtected(service, "initializePostHog").mockResolvedValue(
      true,
    );
    mockGetPostHogServerClient = spyOnProtected(service, "getPostHogClient").mockReturnValue({
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    });
    mockShutdownPostHog = spyOnProtected(service, "shutdownPostHogClient").mockResolvedValue(
      undefined,
    );
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
        { personProperties: undefined, sendFeatureFlagEvents: false },
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
        { personProperties: undefined, sendFeatureFlagEvents: false },
      );
    });

    it("should pass person properties to PostHog", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockResolvedValue(true),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      await service.isFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION, "props-user", {
        organization_ids: "org-a,org-b",
      });

      expect(mockClient.isFeatureEnabled).toHaveBeenCalledWith(
        FEATURE_FLAGS.EXPERIMENT_DELETION,
        "props-user",
        { personProperties: { organization_ids: "org-a,org-b" }, sendFeatureFlagEvents: false },
      );
    });

    it("should cache each set of person properties separately", async () => {
      const mockClient = {
        isFeatureEnabled: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const inPilot = { organization_ids: "org-pilot" };
      const elsewhere = { organization_ids: "org-other" };

      await expect(
        service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "cache-user", inPilot),
      ).resolves.toBe(true);
      await expect(
        service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "cache-user", elsewhere),
      ).resolves.toBe(false);
      await expect(
        service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "cache-user", inPilot),
      ).resolves.toBe(true);

      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2);
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

    it("shares one request between concurrent evaluations of a key", async () => {
      let answer: (value: boolean) => void = () => undefined;
      const mockClient = {
        isFeatureEnabled: vi.fn(
          () =>
            new Promise<boolean>((resolve) => {
              answer = resolve;
            }),
        ),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const evaluations = [1, 2, 3].map(() =>
        service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, "page-load-user"),
      );
      answer(true);

      await expect(Promise.all(evaluations)).resolves.toEqual([true, true, true]);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(1);
    });

    describe("while PostHog fails", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("asks PostHog once for a failing key within the fallback's seconds", async () => {
        const mockClient = {
          isFeatureEnabled: vi.fn().mockRejectedValue(new Error("timeout")),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);

        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "outage-user");
        await vi.advanceTimersByTimeAsync(9_000);
        const second = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.MACRO_DELETION,
          "outage-user",
        );

        expect(second).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.MACRO_DELETION]);
        expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(1);
      });

      it("asks PostHog again once the fallback's seconds pass, and takes its answer", async () => {
        const mockClient = {
          isFeatureEnabled: vi
            .fn()
            .mockRejectedValueOnce(new Error("timeout"))
            .mockResolvedValueOnce(true),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);

        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "recovery-user");
        await vi.advanceTimersByTimeAsync(10_001);

        await expect(
          service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "recovery-user"),
        ).resolves.toBe(true);
        expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2);
      });

      it("holds an empty answer for seconds, not a minute", async () => {
        const mockClient = {
          isFeatureEnabled: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(true),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);

        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "empty-user");
        await vi.advanceTimersByTimeAsync(9_000);
        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "empty-user");
        expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1_001);
        await expect(
          service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "empty-user"),
        ).resolves.toBe(true);
      });

      it("answers every key from its default while a failure pauses evaluations", async () => {
        const mockClient = {
          isFeatureEnabled: vi
            .fn()
            .mockRejectedValueOnce(new Error("timeout"))
            .mockResolvedValue(true),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);

        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "first-user");
        const other = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.STORE_EXPERIMENT_READS,
          "second-user",
        );
        expect(other).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.STORE_EXPERIMENT_READS]);
        expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10_001);
        await expect(
          service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, "second-user"),
        ).resolves.toBe(true);
      });

      it("pauses evaluations when the client reports a failed request", async () => {
        vi.spyOn(configService, "isConfigured").mockReturnValue(true);
        vi.spyOn(configService, "posthogKey", "get").mockReturnValue("test-key");
        let reportFailure: (error: unknown) => void = () => undefined;
        const on = vi.fn((_event: string, listener: (error: unknown) => void) => {
          reportFailure = listener;
          return () => undefined;
        });
        const mockClient = {
          isFeatureEnabled: vi.fn().mockResolvedValue(true),
          on,
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);
        await service.onModuleInit();

        reportFailure(new Error("timeout"));
        const paused = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.STORE_EXPERIMENT_READS,
          "paused-user",
        );

        expect(on).toHaveBeenCalledWith("error", expect.any(Function));
        expect(paused).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.STORE_EXPERIMENT_READS]);
        expect(mockClient.isFeatureEnabled).not.toHaveBeenCalled();
      });

      it("evicts the oldest entry at capacity, counting a refreshed key as the newest", async () => {
        const mockClient = {
          isFeatureEnabled: vi
            .fn<(flagKey: string, distinctId: string) => Promise<boolean | undefined>>()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue(true),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);
        const evaluate = (user: number) =>
          service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, `user-${user}`);

        // user-0's empty answer lapses after seconds, everyone else's after a minute.
        for (let user = 0; user < 4_999; user++) {
          await evaluate(user);
        }
        await vi.advanceTimersByTimeAsync(10_001);
        await evaluate(0);
        await evaluate(4_999);
        await evaluate(5_000);
        mockClient.isFeatureEnabled.mockClear();

        await evaluate(0);
        await evaluate(1);

        const asked = mockClient.isFeatureEnabled.mock.calls.map(([, distinctId]) => distinctId);
        expect(asked).toEqual(["user-1"]);
      });
    });
  });

  describe("isInitialized", () => {
    it("should return a boolean value", () => {
      const result = service.isInitialized();
      expect(typeof result).toBe("boolean");
    });
  });
});
