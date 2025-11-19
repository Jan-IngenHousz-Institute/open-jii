import type { ConfigService } from "@nestjs/config";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnalyticsConfigService } from "./config.service";

describe("AnalyticsConfigService", () => {
  let service: AnalyticsConfigService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === "analytics.posthogKey") return "phc_test_key_123";
        if (key === "analytics.posthogHost") return "https://eu.i.posthog.com";
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AnalyticsConfigService(mockConfigService);
  });

  describe("config properties", () => {
    it("should return posthogKey from config", () => {
      const posthogKey = service.posthogKey;
      expect(posthogKey).toBe("phc_test_key_123");
    });

    it("should return posthogHost from config", () => {
      const posthogHost = service.posthogHost;
      expect(posthogHost).toBe("https://eu.i.posthog.com");
    });

    it("should use default posthogHost when not configured", () => {
      mockConfigService = {
        get: vi.fn(() => undefined),
      } as unknown as ConfigService;

      service = new AnalyticsConfigService(mockConfigService);
      expect(service.posthogHost).toBe("https://eu.i.posthog.com");
    });
  });

  describe("isConfigured", () => {
    it("should return true when valid key is configured", () => {
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when key is undefined", () => {
      mockConfigService = {
        get: vi.fn(() => undefined),
      } as unknown as ConfigService;

      service = new AnalyticsConfigService(mockConfigService);
      expect(service.isConfigured()).toBe(false);
    });

    it("should return false when key is phc_0000", () => {
      mockConfigService = {
        get: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_0000";
          if (key === "analytics.posthogHost") return "https://eu.i.posthog.com";
          return undefined;
        }),
      } as unknown as ConfigService;

      service = new AnalyticsConfigService(mockConfigService);
      expect(service.isConfigured()).toBe(false);
    });

    it("should return false when key starts with phc_0000", () => {
      mockConfigService = {
        get: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_0000_test";
          if (key === "analytics.posthogHost") return "https://eu.i.posthog.com";
          return undefined;
        }),
      } as unknown as ConfigService;

      service = new AnalyticsConfigService(mockConfigService);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe("getPostHogServerConfig", () => {
    it("should return PostHog server configuration", () => {
      const config = service.getPostHogServerConfig();
      expect(config).toBeDefined();
      expect(config.host).toBe("https://eu.i.posthog.com");
    });
  });

  describe("config validation", () => {
    it("should throw error for invalid posthogHost URL", () => {
      mockConfigService = {
        get: vi.fn((key: string) => {
          if (key === "analytics.posthogKey") return "phc_test";
          if (key === "analytics.posthogHost") return "not-a-url";
          return undefined;
        }),
      } as unknown as ConfigService;

      expect(() => {
        new AnalyticsConfigService(mockConfigService);
      }).toThrow("Analytics configuration validation failed");
    });
  });
});
