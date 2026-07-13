import { TestHarness } from "../../../test/test-harness";
import { ErrorCodes } from "../../utils/error-codes";
import { AppError, assertFailure, assertSuccess, failure, success } from "../../utils/fp-utils";
import { AwsAdapter } from "./aws.adapter";
import { CognitoService } from "./services/cognito/cognito.service";
import { AwsConfigService } from "./services/config/config.service";
import { AwsIotService } from "./services/iot/iot.service";
import { AwsLambdaService } from "./services/lambda/lambda.service";
import { AwsLocationService } from "./services/location/location.service";
import { AwsS3Service } from "./services/s3/s3.service";
import type { IotUploadUrl } from "./services/s3/s3.types";

describe("AwsAdapter", () => {
  const testApp = TestHarness.App;
  let awsAdapter: AwsAdapter;
  let awsLocationService: AwsLocationService;
  let cognitoService: CognitoService;
  let awsLambdaService: AwsLambdaService;
  let awsConfigService: AwsConfigService;
  let awsS3Service: AwsS3Service;
  let awsIotService: AwsIotService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    awsAdapter = testApp.module.get(AwsAdapter);
    awsLocationService = testApp.module.get(AwsLocationService);
    cognitoService = testApp.module.get(CognitoService);
    awsLambdaService = testApp.module.get(AwsLambdaService);
    awsConfigService = testApp.module.get(AwsConfigService);
    awsS3Service = testApp.module.get(AwsS3Service);
    awsIotService = testApp.module.get(AwsIotService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("searchPlaces", () => {
    it("should return successful search results when AWS Location Service returns places", async () => {
      const mockPlaces = [
        {
          label: "New York City, NY, USA",
          latitude: 40.7128,
          longitude: -74.006,
          country: "USA",
          region: "NY",
          municipality: "New York City",
          postalCode: "10001",
        },
      ];

      // Mock the AWS Location Service searchPlaces method
      vi.spyOn(awsLocationService, "searchPlaces").mockResolvedValue(mockPlaces);

      const result = await awsAdapter.searchPlaces({ query: "New York" });

      assertSuccess(result);
      expect(result.value).toEqual(mockPlaces);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsLocationService.searchPlaces).toHaveBeenCalledWith({ query: "New York" });
    });

    it("should return failure when AWS Location Service throws an error", async () => {
      // Mock the AWS Location Service to throw an error
      vi.spyOn(awsLocationService, "searchPlaces").mockRejectedValue(new Error("Service error"));

      const result = await awsAdapter.searchPlaces({ query: "Error" });

      assertFailure(result);
      expect(result.error.message).toContain("Place search failed: Service error");
    });

    it("should return failure when AWS Location Service throws a non-Error object", async () => {
      vi.spyOn(awsLocationService, "searchPlaces").mockRejectedValue("Unknown error string");

      const result = await awsAdapter.searchPlaces({ query: "Error" });

      assertFailure(result);
      expect(result.error.message).toContain("Unknown error occurred during place search");
    });
  });

  describe("geocodeLocation", () => {
    it("should return successful geocoding results when AWS Location Service returns coordinates", async () => {
      const mockGeocodeResults = [
        {
          label: "123 Main St, New York, NY 10001, USA",
          latitude: 40.7128,
          longitude: -74.006,
          country: "USA",
          region: "NY",
          municipality: "New York",
          postalCode: "10001",
        },
      ];

      // Mock the AWS Location Service geocodeLocation method
      vi.spyOn(awsLocationService, "geocodeLocation").mockResolvedValue(mockGeocodeResults);

      const result = await awsAdapter.geocodeLocation({ latitude: 40.7128, longitude: -74.006 });

      assertSuccess(result);
      expect(result.value).toEqual(mockGeocodeResults);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsLocationService.geocodeLocation).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.006,
      });
    });

    it("should return failure when AWS Location Service throws an error during geocoding", async () => {
      // Mock the AWS Location Service to throw an error
      vi.spyOn(awsLocationService, "geocodeLocation").mockRejectedValue(
        new Error("Invalid coordinates"),
      );

      const result = await awsAdapter.geocodeLocation({ latitude: 999, longitude: 999 });

      assertFailure(result);
      expect(result.error.message).toContain("Geocoding failed: Invalid coordinates");
    });

    it("should return failure when AWS Location Service throws a non-Error object during geocoding", async () => {
      vi.spyOn(awsLocationService, "geocodeLocation").mockRejectedValue("Unknown geocoding error");

      const result = await awsAdapter.geocodeLocation({ latitude: 40.7128, longitude: -74.006 });

      assertFailure(result);
      expect(result.error.message).toContain("Unknown error occurred during geocoding");
    });
  });

  describe("getIotCredentials", () => {
    it("should return IoT credentials when both cognito steps succeed", async () => {
      const userId = "test-user-123";
      const mockTokenResult = {
        identityId: "eu-central-1:identity-id-123",
        token: "mock-openid-token",
      };
      const mockCredentials = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "mock-session-token",
        expiration: new Date("2026-02-06T12:00:00Z"),
      };

      vi.spyOn(cognitoService, "getOpenIdToken").mockResolvedValue(success(mockTokenResult));
      vi.spyOn(cognitoService, "attachIotPolicy").mockResolvedValue(success(undefined));
      vi.spyOn(cognitoService, "getCredentialsForIdentity").mockResolvedValue(
        success(mockCredentials),
      );

      const result = await awsAdapter.getIotCredentials(userId);

      assertSuccess(result);
      expect(result.value).toEqual(mockCredentials);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cognitoService.getOpenIdToken).toHaveBeenCalledWith(userId);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cognitoService.getCredentialsForIdentity).toHaveBeenCalledWith(
        mockTokenResult.identityId,
        mockTokenResult.token,
      );
    });

    it("should return failure when attachIotPolicy fails", async () => {
      const userId = "test-user-123";
      const mockTokenResult = {
        identityId: "eu-central-1:identity-id-123",
        token: "mock-openid-token",
      };
      const error = AppError.internal("IoT attach failed", ErrorCodes.AWS_IOT_ATTACH_POLICY_FAILED);

      vi.spyOn(cognitoService, "getOpenIdToken").mockResolvedValue(success(mockTokenResult));
      vi.spyOn(cognitoService, "attachIotPolicy").mockResolvedValue(failure(error));

      const result = await awsAdapter.getIotCredentials(userId);

      assertFailure(result);
      expect(result.error.message).toBe("IoT attach failed");
    });

    it("should return failure when getOpenIdToken fails", async () => {
      const userId = "test-user-123";
      const error = AppError.internal("Token failed", ErrorCodes.AWS_COGNITO_TOKEN_FAILED);

      vi.spyOn(cognitoService, "getOpenIdToken").mockResolvedValue(failure(error));
      const credsSpy = vi.spyOn(cognitoService, "getCredentialsForIdentity");

      const result = await awsAdapter.getIotCredentials(userId);

      assertFailure(result);
      expect(result.error.message).toBe("Token failed");
      expect(credsSpy).not.toHaveBeenCalled();
    });

    it("should return failure when getCredentialsForIdentity fails", async () => {
      const userId = "test-user-123";
      const mockTokenResult = {
        identityId: "eu-central-1:identity-id-123",
        token: "mock-openid-token",
      };
      const error = AppError.internal(
        "Credentials failed",
        ErrorCodes.AWS_COGNITO_CREDENTIALS_FAILED,
      );

      vi.spyOn(cognitoService, "getOpenIdToken").mockResolvedValue(success(mockTokenResult));
      vi.spyOn(cognitoService, "attachIotPolicy").mockResolvedValue(success(undefined));
      vi.spyOn(cognitoService, "getCredentialsForIdentity").mockResolvedValue(failure(error));

      const result = await awsAdapter.getIotCredentials(userId);

      assertFailure(result);
      expect(result.error.message).toBe("Credentials failed");
    });
  });

  describe("invokeLambda", () => {
    it("should delegate to AwsLambdaService.invoke and return a success result", async () => {
      const mockResponse = {
        statusCode: 200,
        payload: { status: "success", results: [] },
      };

      vi.spyOn(awsLambdaService, "invoke").mockResolvedValue(success(mockResponse));

      const result = await awsAdapter.invokeLambda("my-function", { data: "test" });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsLambdaService.invoke).toHaveBeenCalledWith({
        functionName: "my-function",
        payload: { data: "test" },
      });
      expect(result.isSuccess()).toBe(true);
    });

    it("should propagate failure from AwsLambdaService", async () => {
      vi.spyOn(awsLambdaService, "invoke").mockResolvedValue(
        failure(AppError.internal("Lambda timeout")),
      );

      const result = await awsAdapter.invokeLambda("my-function", {});

      expect(result.isFailure()).toBe(true);
    });
  });

  describe("getIotUploadUrl", () => {
    it("delegates to AwsS3Service and returns the upload URL on success", async () => {
      const mockUploadUrl: IotUploadUrl = {
        uploadUrl: "https://s3.amazonaws.com/bucket/large-iot/exp-123/uuid.json?signed=1",
        key: "large-iot/exp-123/uuid.json",
        expiresAt: new Date("2026-05-21T00:00:00Z"),
      };

      vi.spyOn(awsS3Service, "getIotUploadUrl").mockResolvedValue(success(mockUploadUrl));

      const result = await awsAdapter.getIotUploadUrl("exp-123");

      assertSuccess(result);
      expect(result.value).toEqual(mockUploadUrl);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsS3Service.getIotUploadUrl).toHaveBeenCalledWith("exp-123");
    });

    it("propagates failure from AwsS3Service", async () => {
      const error = AppError.internal("S3 presign failed", ErrorCodes.AWS_S3_PRESIGN_FAILED);

      vi.spyOn(awsS3Service, "getIotUploadUrl").mockResolvedValue(failure(error));

      const result = await awsAdapter.getIotUploadUrl("exp-123");

      assertFailure(result);
      expect(result.error.message).toBe("S3 presign failed");
      expect(result.error.code).toBe(ErrorCodes.AWS_S3_PRESIGN_FAILED);
    });
  });

  describe("createThing", () => {
    const input = {
      thingName: "AMBYTE_E8:F6:0A:B1:1D:D4",
      attributes: { serialNumber: "E8:F6:0A:B1:1D:D4", deviceType: "ambyte" },
    };

    it("delegates to AwsIotService and returns the created thing on success", async () => {
      const created = { thingName: input.thingName, thingArn: "arn:aws:iot:thing/x" };
      vi.spyOn(awsIotService, "createThing").mockResolvedValue(success(created));

      const result = await awsAdapter.createThing(input);

      assertSuccess(result);
      expect(result.value).toEqual(created);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsIotService.createThing).toHaveBeenCalledWith(input);
    });

    it("propagates failure from AwsIotService", async () => {
      const error = AppError.internal("create failed", ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
      vi.spyOn(awsIotService, "createThing").mockResolvedValue(failure(error));

      const result = await awsAdapter.createThing(input);

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_CREATE_THING_FAILED);
    });
  });

  describe("deleteThing", () => {
    it("delegates to AwsIotService and returns success", async () => {
      vi.spyOn(awsIotService, "deleteThing").mockResolvedValue(success(undefined));

      const result = await awsAdapter.deleteThing("AMBYTE_E8:F6:0A:B1:1D:D4");

      assertSuccess(result);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(awsIotService.deleteThing).toHaveBeenCalledWith("AMBYTE_E8:F6:0A:B1:1D:D4");
    });

    it("propagates failure from AwsIotService", async () => {
      const error = AppError.internal("delete failed", ErrorCodes.AWS_IOT_DELETE_THING_FAILED);
      vi.spyOn(awsIotService, "deleteThing").mockResolvedValue(failure(error));

      const result = await awsAdapter.deleteThing("missing");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_DELETE_THING_FAILED);
    });
  });

  describe("createDeviceCertificate", () => {
    it("delegates to AwsIotService.createKeysAndCertificate", async () => {
      const cert = {
        certificateId: "c1",
        certificateArn: "arn:c1",
        certificatePem: "PEM",
        privateKey: "KEY",
      };
      vi.spyOn(awsIotService, "createKeysAndCertificate").mockResolvedValue(success(cert));

      const result = await awsAdapter.createDeviceCertificate();

      assertSuccess(result);
      expect(result.value).toEqual(cert);
    });
  });

  describe("attachThingPrincipal", () => {
    it("delegates to AwsIotService and returns success", async () => {
      const spy = vi
        .spyOn(awsIotService, "attachThingPrincipal")
        .mockResolvedValue(success(undefined));

      const result = await awsAdapter.attachThingPrincipal("thing-1", "arn:cert");

      assertSuccess(result);
      expect(spy).toHaveBeenCalledWith("thing-1", "arn:cert");
    });

    it("propagates failure from AwsIotService", async () => {
      const error = AppError.internal("attach failed", ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
      vi.spyOn(awsIotService, "attachThingPrincipal").mockResolvedValue(failure(error));

      const result = await awsAdapter.attachThingPrincipal("thing-1", "arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
    });
  });

  describe("detachThingPrincipal", () => {
    it("delegates to AwsIotService and returns success", async () => {
      const spy = vi
        .spyOn(awsIotService, "detachThingPrincipal")
        .mockResolvedValue(success(undefined));

      const result = await awsAdapter.detachThingPrincipal("thing-1", "arn:cert");

      assertSuccess(result);
      expect(spy).toHaveBeenCalledWith("thing-1", "arn:cert");
    });

    it("propagates failure from AwsIotService", async () => {
      const error = AppError.internal("detach failed", ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
      vi.spyOn(awsIotService, "detachThingPrincipal").mockResolvedValue(failure(error));

      const result = await awsAdapter.detachThingPrincipal("thing-1", "arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_PRINCIPAL_FAILED);
    });
  });

  describe("attachDevicePolicies", () => {
    it("attaches every configured policy to the certificate", async () => {
      const attachSpy = vi
        .spyOn(awsIotService, "attachPolicy")
        .mockResolvedValue(success(undefined));

      const result = await awsAdapter.attachDevicePolicies("arn:cert");

      assertSuccess(result);
      expect(attachSpy).toHaveBeenCalledTimes(awsConfigService.iotPolicyNames.length);
      for (const policyName of awsConfigService.iotPolicyNames) {
        expect(attachSpy).toHaveBeenCalledWith(policyName, "arn:cert");
      }
    });

    it("stops and propagates the first policy attachment failure", async () => {
      const error = AppError.internal(
        "attach failed",
        ErrorCodes.AWS_IOT_ATTACH_CERT_POLICY_FAILED,
      );
      const attachSpy = vi.spyOn(awsIotService, "attachPolicy").mockResolvedValue(failure(error));

      const result = await awsAdapter.attachDevicePolicies("arn:cert");

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.AWS_IOT_ATTACH_CERT_POLICY_FAILED);
      expect(attachSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("setCertificateStatus", () => {
    it("delegates to AwsIotService.updateCertificateStatus", async () => {
      const spy = vi
        .spyOn(awsIotService, "updateCertificateStatus")
        .mockResolvedValue(success(undefined));

      const result = await awsAdapter.setCertificateStatus("cert-1", "REVOKED");

      assertSuccess(result);
      expect(spy).toHaveBeenCalledWith("cert-1", "REVOKED");
    });
  });

  describe("getFunctionNameForLanguage", () => {
    it("should return the python function name for 'python'", () => {
      const name = awsAdapter.getFunctionNameForLanguage("python");
      expect(name).toBe(awsConfigService.lambdaConfig.macroSandboxPythonFunctionName);
    });

    it("should return the javascript function name for 'javascript'", () => {
      const name = awsAdapter.getFunctionNameForLanguage("javascript");
      expect(name).toBe(awsConfigService.lambdaConfig.macroSandboxJavascriptFunctionName);
    });

    it("should return the R function name for 'r'", () => {
      const name = awsAdapter.getFunctionNameForLanguage("r");
      expect(name).toBe(awsConfigService.lambdaConfig.macroSandboxRFunctionName);
    });

    it("should throw for an unsupported language", () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      expect(() => awsAdapter.getFunctionNameForLanguage("ruby" as any)).toThrow(
        "No Lambda function configured for language: ruby",
      );
    });
  });
});
