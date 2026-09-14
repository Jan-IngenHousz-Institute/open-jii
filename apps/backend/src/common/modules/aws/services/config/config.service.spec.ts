import { ConfigService } from "@nestjs/config";
import type { ConfigType } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import type awsConfig from "../../../../config/aws.config";
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

    it("should return the correct iotPolicyNames", () => {
      expect(service.iotPolicyNames).toEqual(
        process.env.AWS_IOT_POLICY_NAMES?.split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      );
    });

    it("should return the correct iotJobsPolicyName", () => {
      expect(service.iotJobsPolicyName).toBe(process.env.AWS_IOT_JOBS_POLICY_NAME);
    });

    it("should return the correct deviceThingTypeName", () => {
      expect(service.deviceThingTypeName).toBe(process.env.AWS_IOT_DEVICE_THING_TYPE_NAME);
    });

    it("should return the correct deviceThingGroupName", () => {
      expect(service.deviceThingGroupName).toBe(process.env.AWS_IOT_DEVICE_THING_GROUP_NAME);
    });

    it("reads the calibration sandbox function name and leaves the endpoint empty when unset", () => {
      expect(service.lambdaConfig.calibrationSandboxFunctionName).toBe(
        process.env.AWS_LAMBDA_CALIBRATION_SANDBOX_FUNCTION_NAME,
      );
      expect(service.lambdaConfig.calibrationSandboxEndpoint).toBe("");
    });
  });

  describe("config validation", () => {
    it("rejects a calibration sandbox endpoint that is not a URL", () => {
      const aws = testApp.module.get(ConfigService).get<ConfigType<typeof awsConfig>>("aws");
      if (!aws) {
        throw new Error("The aws configuration namespace is not loaded");
      }
      const withBadEndpoint = new ConfigService({
        aws: { ...aws, lambda: { ...aws.lambda, calibrationSandboxEndpoint: "not-a-url" } },
      });

      expect(() => new AwsConfigService(withBadEndpoint)).toThrow(
        "AWS configuration validation failed",
      );
    });

    it("should throw error for invalid config during construction", () => {
      // Create a mock ConfigService that returns invalid data
      const configService = testApp.module.get(ConfigService);
      const getOrThrowSpy = vi
        .spyOn(configService, "getOrThrow")
        .mockImplementation((key: string) => {
          if (key === "aws.region") {
            return "";
          }
        });

      expect(() => new AwsConfigService(configService)).toThrow(
        "AWS configuration validation failed",
      );

      getOrThrowSpy.mockRestore();
    });
  });
});
