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

  describe("validateConfig", () => {
    it("should throw an error if the config is invalid", () => {
      const configService = testApp.module.get(ConfigService);
      const getOrThrowSpy = vi
        .spyOn(configService, "getOrThrow")
        .mockImplementation((key: string) => {
          if (key === "aws.region") {
            return "";
          }

          return "valid_string";
        });

      expect(() => new AwsConfigService(configService)).toThrow(
        "AWS configuration validation failed",
      );

      getOrThrowSpy.mockRestore();
    });
  });
});
