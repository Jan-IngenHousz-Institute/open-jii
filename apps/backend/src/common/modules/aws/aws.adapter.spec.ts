import { TestHarness } from "../../../test/test-harness";
import { ErrorCodes } from "../../utils/error-codes";
import { AppError, assertFailure, assertSuccess, failure, success } from "../../utils/fp-utils";
import { AwsAdapter } from "./aws.adapter";
import { CognitoService } from "./services/cognito/cognito.service";
import { AwsLocationService } from "./services/location/location.service";

describe("AwsAdapter", () => {
  const testApp = TestHarness.App;
  let awsAdapter: AwsAdapter;
  let awsLocationService: AwsLocationService;
  let cognitoService: CognitoService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    awsAdapter = testApp.module.get(AwsAdapter);
    awsLocationService = testApp.module.get(AwsLocationService);
    cognitoService = testApp.module.get(CognitoService);
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
      vi.spyOn(cognitoService, "getCredentialsForIdentity").mockResolvedValue(failure(error));

      const result = await awsAdapter.getIotCredentials(userId);

      assertFailure(result);
      expect(result.error.message).toBe("Credentials failed");
    });
  });
});
