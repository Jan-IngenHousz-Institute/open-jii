import { ConfigService } from "@nestjs/config";

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

  describe("getter methods", () => {
    it("should return the correct region", () => {
      expect(service.region).toBe(process.env.AWS_REGION);
    });

    it("should return the correct placeIndexName", () => {
      expect(service.placeIndexName).toBe(process.env.AWS_LOCATION_PLACE_INDEX_NAME);
    });

    it("should return the correct cognitoIdentityPoolId", () => {
      expect(service.cognitoIdentityPoolId).toBe(process.env.AWS_COGNITO_IDENTITY_POOL_ID);
    });

    it("should return the correct cognitoDeveloperProviderName", () => {
      expect(service.cognitoDeveloperProviderName).toBe(
        process.env.AWS_COGNITO_DEVELOPER_PROVIDER_NAME,
      );
    });
  });

  describe("config validation", () => {
    it("should throw error for invalid config during construction", () => {
      // Create a mock ConfigService that returns invalid data
      const mockConfigService = {
        getOrThrow: vi.fn((key: string) => {
          if (key === "aws.region") return ""; // Invalid empty region
          if (key === "aws.location.placeIndexName") return "test-index";
          if (key === "aws.lambda.macroRunnerPythonFunctionName") return "fn-py";
          if (key === "aws.lambda.macroRunnerJavascriptFunctionName") return "fn-js";
          if (key === "aws.lambda.macroRunnerRFunctionName") return "fn-r";
          throw new Error(`Unknown config key: ${key}`);
        }),
      } as unknown as ConfigService;

      expect(() => new AwsConfigService(mockConfigService)).toThrow(
        "AWS configuration validation failed",
      );
    });
  });
});
