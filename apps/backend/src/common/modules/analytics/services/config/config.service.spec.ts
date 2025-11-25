import type { ConfigService } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import { AnalyticsConfigService } from "./config.service";

describe("AnalyticsConfigService", () => {
  const testApp = TestHarness.App;
  let service: AnalyticsConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(AnalyticsConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("config properties", () => {
    it("should return posthogKey from config", () => {
      const posthogKey = service.posthogKey;
      expect(posthogKey).toBeDefined();
      expect(typeof posthogKey).toBe("string");
    });

    it("should return posthogHost from config", () => {
      const posthogHost = service.posthogHost;
      expect(posthogHost).toBeDefined();
      expect(typeof posthogHost).toBe("string");
    });
  });

  describe("isConfigured", () => {
    it("should return true when valid key is configured", () => {
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when key is phc_0000", () => {
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_0000";
          if (key === "analytics.posthogHost") return "https://eu.i.posthog.com";
          throw new Error(`Unknown config key: ${key}`);
        }),
      } as unknown as ConfigService;

      const testService = new AnalyticsConfigService(mockConfigService);
      expect(testService.isConfigured()).toBe(false);
    });

    it("should return false when key starts with phc_0000", () => {
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_0000_test";
          if (key === "analytics.posthogHost") return "https://eu.i.posthog.com";
          throw new Error(`Unknown config key: ${key}`);
        }),
      } as unknown as ConfigService;

      const testService = new AnalyticsConfigService(mockConfigService);
      expect(testService.isConfigured()).toBe(false);
    });
  });

  describe("getPostHogServerConfig", () => {
    it("should return PostHog server configuration", () => {
      const config = service.getPostHogServerConfig();
      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(typeof config.host).toBe("string");
    });
  });

  describe("config validation", () => {
    it("should throw error for invalid posthogHost URL", () => {
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_test";
          if (key === "analytics.posthogHost") return "not-a-url";
          throw new Error(`Unknown config key: ${key}`);
        }),
      } as unknown as ConfigService;

      expect(() => {
        new AnalyticsConfigService(mockConfigService);
      }).toThrow("Analytics configuration validation failed");
    });
  });
});
