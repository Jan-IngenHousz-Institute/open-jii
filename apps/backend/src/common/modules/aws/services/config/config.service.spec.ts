import type { ConfigService } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import { AwsConfigService } from "./config.service";

describe("AwsConfigService", () => {
  const testApp = TestHarness.App;
  let service: AwsConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(AwsConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("config properties", () => {
    it("should return region from config", () => {
      const region = service.region;
      expect(region).toBeDefined();
      expect(typeof region).toBe("string");
    });

    it("should return placeIndexName from config", () => {
      const placeIndexName = service.placeIndexName;
      expect(placeIndexName).toBeDefined();
      expect(typeof placeIndexName).toBe("string");
    });
  });

  describe("config validation", () => {
    it("should throw error for invalid config during construction", () => {
      // Create a mock ConfigService that returns invalid data
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "aws.region") return ""; // Invalid empty region
          if (key === "aws.location.placeIndexName") return "test-index";
          if (key === "aws.cognito.identityPoolId") return "test-pool-id";
          if (key === "aws.cognito.developerProviderName") return "test-provider";
          throw new Error(`Unknown config key: ${key}`);
        }),
      } as unknown as ConfigService;

      expect(() => {
        new AwsConfigService(mockConfigService);
      }).toThrow("AWS configuration validation failed");
    });
  });
});
