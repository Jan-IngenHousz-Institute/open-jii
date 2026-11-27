import { PostHog } from "posthog-node";
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
    // The module's instance lives as long as the file, and a failure would pause it for every
    // test after.
    service = new FlagsService(configService);

    // Create fresh spies on the protected wrapper methods
    mockInitializePostHogServer = spyOnProtected(service, "initializePostHog").mockResolvedValue(
      true,
    );
    mockGetPostHogServerClient = spyOnProtected(service, "getPostHogClient").mockReturnValue({
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
      on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
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
        on: vi.fn(() => () => undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      const evaluations = [1, 2, 3].map(() =>
        service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, "page-load-user"),
      );
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(1);
      answer(true);

      await expect(Promise.all(evaluations)).resolves.toEqual([true, true, true]);
    });

    it("keeps answering from the cache while a failure pauses evaluations", async () => {
      const mockClient = {
        isFeatureEnabled: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("timeout")),
        on: vi.fn(() => () => undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);

      await service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, "cached-user");
      await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "failing-user");

      await expect(
        service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, "cached-user"),
      ).resolves.toBe(true);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2);
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
          on: vi.fn(() => () => undefined),
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
          on: vi.fn(() => () => undefined),
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
          on: vi.fn(() => () => undefined),
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
          on: vi.fn(() => () => undefined),
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

      it("caches nothing for a failed flag request, so a full cache keeps its live answers", async () => {
        let reportFailure: ((error: unknown) => void) | undefined;
        const mockClient = {
          isFeatureEnabled: vi.fn((_flagKey: string, distinctId: string) => {
            if (distinctId === "failing-user") {
              reportFailure?.(new Error("timeout"));
              return Promise.resolve(undefined);
            }
            return Promise.resolve(true);
          }),
          on: vi.fn((_event: string, listener: (error: unknown) => void) => {
            reportFailure = listener;
            return () => {
              reportFailure = undefined;
            };
          }),
          shutdown: vi.fn().mockResolvedValue(undefined),
        };
        mockGetPostHogServerClient.mockReturnValue(mockClient);
        const evaluate = (user: string) =>
          service.isFeatureFlagEnabled(FEATURE_FLAGS.STORE_EXPERIMENT_READS, user);

        for (let user = 0; user < 5_000; user++) {
          await evaluate(`user-${user}`);
        }
        await evaluate("failing-user");

        await expect(evaluate("user-0")).resolves.toBe(true);
      });

      it("evicts the oldest entry at capacity, counting a refreshed key as the newest", async () => {
        const mockClient = {
          isFeatureEnabled: vi
            .fn<(flagKey: string, distinctId: string) => Promise<boolean | undefined>>()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue(true),
          on: vi.fn(() => () => undefined),
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

    describe("on posthog-node's own client", () => {
      const clients: PostHog[] = [];

      /** posthog-node as the backend runs it, with every request it makes answered by `answer`. */
      function postHog(answer: (path: string) => Promise<Response>): PostHog {
        const client = new PostHog("phc_test", {
          host: "https://posthog.test",
          fetch: (url) => answer(new URL(url).pathname),
          flushAt: 1,
          fetchRetryCount: 0,
          featureFlagsRequestMaxRetries: 0,
        });
        clients.push(client);
        mockGetPostHogServerClient.mockReturnValue(client);
        return client;
      }

      function storeReadsOn(): Response {
        const key = FEATURE_FLAGS.STORE_EXPERIMENT_READS;
        return Response.json({ flags: { [key]: { key, enabled: true, variant: null } } });
      }

      afterEach(async () => {
        await Promise.all(clients.splice(0).map((client) => client.shutdown(100)));
      });

      it("pauses every uncached flag once a flag request fails", async () => {
        const paths: string[] = [];
        postHog((path) => {
          paths.push(path);
          return Promise.reject(new Error("connect ETIMEDOUT"));
        });

        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "first-user");
        const other = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.STORE_EXPERIMENT_READS,
          "second-user",
        );

        expect(other).toBe(FEATURE_FLAG_DEFAULTS[FEATURE_FLAGS.STORE_EXPERIMENT_READS]);
        expect(paths).toEqual(["/flags/"]);
      });

      it("keeps asking after an exception upload fails mid-request, and after a missing flag", async () => {
        const paths: string[] = [];
        let uploadsMidRequest = true;
        const client = postHog(async (path) => {
          paths.push(path);
          if (path === "/batch/") {
            throw new Error("connect ECONNRESET");
          }
          if (uploadsMidRequest) {
            uploadsMidRequest = false;
            await client.captureExceptionImmediate(new Error("boom"), "uploading-user");
          }
          return storeReadsOn();
        });

        const uploading = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.STORE_EXPERIMENT_READS,
          "uploading-user",
        );
        await service.isFeatureFlagEnabled(FEATURE_FLAGS.MACRO_DELETION, "missing-flag-user");
        const later = await service.isFeatureFlagEnabled(
          FEATURE_FLAGS.STORE_EXPERIMENT_READS,
          "later-user",
        );

        expect([uploading, later]).toEqual([true, true]);
        expect(paths).toEqual(["/flags/", "/batch/", "/flags/", "/flags/"]);
      });
    });
  });

  describe("isFeatureFlagEnabledOrStale", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const flagKey = FEATURE_FLAGS.STORE_EXPERIMENT_READS;

    it("answers a lapsed key from its held answer at once, and from the refresh after it", async () => {
      let answerRefresh: (value: boolean) => void = () => undefined;
      const mockClient = {
        isFeatureEnabled: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockImplementationOnce(
            () =>
              new Promise<boolean>((resolve) => {
                answerRefresh = resolve;
              }),
          ),
        on: vi.fn(() => () => undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);
      const read = () => service.isFeatureFlagEnabledOrStale(flagKey, "environment-reader");

      // Nothing held yet, so the first read waits for PostHog's answer.
      await expect(read()).resolves.toBe(true);
      vi.setSystemTime(Date.now() + 60_001);

      // The refresh is still waiting on PostHog; the read does not.
      await expect(read()).resolves.toBe(true);
      await expect(read()).resolves.toBe(true);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2);

      // A caller that needs a fresh answer still waits for the refresh.
      const fresh = service.isFeatureFlagEnabled(flagKey, "environment-reader");
      answerRefresh(false);

      await expect(fresh).resolves.toBe(false);
      await expect(read()).resolves.toBe(false);
      expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2);
    });

    it("keeps the held answer when the refresh fails", async () => {
      const mockClient = {
        isFeatureEnabled: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("timeout")),
        on: vi.fn(() => () => undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };
      mockGetPostHogServerClient.mockReturnValue(mockClient);
      const read = () => service.isFeatureFlagEnabledOrStale(flagKey, "environment-reader");

      await read();
      vi.setSystemTime(Date.now() + 60_001);
      await read();
      await vi.waitFor(() => expect(mockClient.isFeatureEnabled).toHaveBeenCalledTimes(2));

      // The failure pauses evaluations and answers the default, but this key keeps its own.
      await expect(read()).resolves.toBe(true);
      expect(FEATURE_FLAG_DEFAULTS[flagKey]).toBe(false);
    });
  });

  describe("isInitialized", () => {
    it("should return a boolean value", () => {
      const result = service.isInitialized();
      expect(typeof result).toBe("boolean");
    });
  });
});
