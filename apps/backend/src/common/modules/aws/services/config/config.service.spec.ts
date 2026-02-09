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

    it("should return cognitoIdentityPoolId from config", () => {
      const cognitoIdentityPoolId = service.cognitoIdentityPoolId;
      expect(cognitoIdentityPoolId).toBeDefined();
      expect(typeof cognitoIdentityPoolId).toBe("string");
    });

    it("should return cognitoDeveloperProviderName from config", () => {
      const cognitoDeveloperProviderName = service.cognitoDeveloperProviderName;
      expect(cognitoDeveloperProviderName).toBeDefined();
      expect(typeof cognitoDeveloperProviderName).toBe("string");
    });
  });

  describe("config validation", () => {
    it("should throw error for invalid config during construction", () => {
      // Create a mock ConfigService that returns invalid data
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "aws.region") return ""; // Invalid empty region
          if (key === "aws.location.placeIndexName") return "test-index";
          throw new Error(`Unknown config key: ${key}`);
        }),
        get: vi.fn((key: string) => {
          if (key === "aws.cognito.identityPoolId") return undefined;
          if (key === "aws.cognito.developerProviderName") return undefined;
          return undefined;
        }),
      } as unknown as ConfigService;

      expect(() => {
        new AwsConfigService(mockConfigService);
      }).toThrow("AWS configuration validation failed");
    });

    it("should use default values for Cognito config when not provided", () => {
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "aws.region") return "us-east-1";
          if (key === "aws.location.placeIndexName") return "test-index";
          throw new Error(`Unknown config key: ${key}`);
        }),
        get: vi.fn(() => undefined), // Return undefined for optional configs
      } as unknown as ConfigService;

      const service = new AwsConfigService(mockConfigService);

      expect(service.cognitoIdentityPoolId).toBe("local-development-pool-id");
      expect(service.cognitoDeveloperProviderName).toBe("local.development");
    });

    it("should use provided Cognito config values when available", () => {
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "aws.region") return "eu-central-1";
          if (key === "aws.location.placeIndexName") return "test-index";
          throw new Error(`Unknown config key: ${key}`);
        }),
        get: vi.fn((key: string) => {
          if (key === "aws.cognito.identityPoolId") return "eu-central-1:test-pool";
          if (key === "aws.cognito.developerProviderName") return "dev.login.example.com";
          return undefined;
        }),
      } as unknown as ConfigService;

      const service = new AwsConfigService(mockConfigService);

      expect(service.cognitoIdentityPoolId).toBe("eu-central-1:test-pool");
      expect(service.cognitoDeveloperProviderName).toBe("dev.login.example.com");
    });
  });
});
