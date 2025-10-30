import { ConfigService } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import { DeltaConfigService } from "./config.service";

describe("DeltaConfigService", () => {
  const testApp = TestHarness.App;
  let configService: DeltaConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    configService = testApp.module.get(DeltaConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("constructor and config loading", () => {
    it("should load configuration successfully with valid environment variables", () => {
      expect(configService).toBeDefined();
      expect(configService.getEndpoint()).toBeDefined();
      expect(configService.getBearerToken()).toBeDefined();
    });

    it("should use default values for optional configuration", () => {
      const timeout = configService.getRequestTimeout();
      const retries = configService.getMaxRetries();

      expect(timeout).toBeGreaterThan(0);
      expect(retries).toBeGreaterThan(0);
    });
  });

  describe("validateConfig", () => {
    it("should throw an error if endpoint is missing", () => {
      // Mock the ConfigService to return invalid config
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      expect(() => new DeltaConfigService(mockConfigService)).toThrow(
        "Invalid Delta Sharing configuration: DELTA_ENDPOINT and DELTA_BEARER_TOKEN are required",
      );

      getSpy.mockRestore();
    });

    it("should throw an error if bearerToken is missing", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      expect(() => new DeltaConfigService(mockConfigService)).toThrow(
        "Invalid Delta Sharing configuration: DELTA_ENDPOINT and DELTA_BEARER_TOKEN are required",
      );

      getSpy.mockRestore();
    });

    it("should throw an error if both endpoint and bearerToken are missing", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return undefined;
        if (key === "delta.bearerToken") return undefined;
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      expect(() => new DeltaConfigService(mockConfigService)).toThrow(
        "Invalid Delta Sharing configuration: DELTA_ENDPOINT and DELTA_BEARER_TOKEN are required",
      );

      getSpy.mockRestore();
    });
  });

  describe("getEndpoint", () => {
    it("should return the endpoint from environment variables", () => {
      const endpoint = configService.getEndpoint();
      expect(endpoint).toBe(process.env.DELTA_ENDPOINT);
    });

    it("should remove trailing slash from endpoint", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com/";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const endpoint = service.getEndpoint();

      expect(endpoint).toBe("https://example.com");
      getSpy.mockRestore();
    });

    it("should not modify endpoint without trailing slash", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const endpoint = service.getEndpoint();

      expect(endpoint).toBe("https://example.com");
      getSpy.mockRestore();
    });
  });

  describe("getBearerToken", () => {
    it("should return the bearer token from environment variables", () => {
      const token = configService.getBearerToken();
      expect(token).toBe(process.env.DELTA_BEARER_TOKEN);
    });
  });

  describe("getRequestTimeout", () => {
    it("should return the request timeout from environment variables", () => {
      const timeout = configService.getRequestTimeout();
      expect(typeof timeout).toBe("number");
      expect(timeout).toBeGreaterThan(0);
    });

    it("should use default timeout when env var is not set", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return undefined;
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const timeout = service.getRequestTimeout();

      expect(timeout).toBe(30000); // Default value
      getSpy.mockRestore();
    });

    it("should parse string timeout to number", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "60000";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const timeout = service.getRequestTimeout();

      expect(timeout).toBe(60000);
      getSpy.mockRestore();
    });

    it("should use default timeout for invalid string", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "invalid";
        if (key === "delta.maxRetries") return "3";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const timeout = service.getRequestTimeout();

      expect(timeout).toBe(30000); // Default value
      getSpy.mockRestore();
    });
  });

  describe("getMaxRetries", () => {
    it("should return the max retries from environment variables", () => {
      const retries = configService.getMaxRetries();
      expect(typeof retries).toBe("number");
      expect(retries).toBeGreaterThan(0);
    });

    it("should use default max retries when env var is not set", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return undefined;
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const retries = service.getMaxRetries();

      expect(retries).toBe(3); // Default value
      getSpy.mockRestore();
    });

    it("should parse string max retries to number", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "5";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const retries = service.getMaxRetries();

      expect(retries).toBe(5);
      getSpy.mockRestore();
    });

    it("should use default max retries for invalid string", () => {
      const mockConfigService = testApp.module.get(ConfigService);
      const getSpy = vi.spyOn(mockConfigService, "get").mockImplementation((key: string) => {
        if (key === "delta.endpoint") return "https://example.com";
        if (key === "delta.bearerToken") return "valid-token";
        if (key === "delta.requestTimeout") return "30000";
        if (key === "delta.maxRetries") return "invalid";
        return undefined;
      });

      const service = new DeltaConfigService(mockConfigService);
      const retries = service.getMaxRetries();

      expect(retries).toBe(3); // Default value
      getSpy.mockRestore();
    });
  });
});
