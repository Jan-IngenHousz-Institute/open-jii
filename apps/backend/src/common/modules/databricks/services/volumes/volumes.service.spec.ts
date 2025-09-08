import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksVolumesService } from "./volumes.service";
import type { CreateVolumeParams, GetVolumeParams, VolumeResponse } from "./volumes.types";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksVolumesService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let volumesService: DatabricksVolumesService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    volumesService = testApp.module.get(DatabricksVolumesService);

    authService = testApp.module.get(DatabricksAuthService);
    authService.clearTokenCache();

    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createVolume", () => {
    const mockCreateVolumeParams: CreateVolumeParams = {
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      name: "test_volume",
      volume_type: "MANAGED",
      comment: "Test volume for experiments",
    };

    const mockVolumeResponse: VolumeResponse = {
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      name: "test_volume",
      full_name: "test_catalog.test_schema.test_volume",
      volume_id: "12345-abcde-67890-fghij",
      volume_type: "MANAGED",
      comment: "Test volume for experiments",
      metastore_id: "meta-12345",
      owner: "test-user@example.com",
      created_at: 1620000000000,
      created_by: "test-user@example.com",
      updated_at: 1620000000000,
      updated_by: "test-user@example.com",
    };

    it("should successfully create a managed volume", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume creation API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, mockVolumeResponse);

      // Execute create volume
      const result = await volumesService.createVolume(mockCreateVolumeParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });

    it("should successfully create an external volume", async () => {
      const externalVolumeParams: CreateVolumeParams = {
        ...mockCreateVolumeParams,
        volume_type: "EXTERNAL",
        storage_location: "s3://my-bucket/volumes/test_volume",
      };

      const externalVolumeResponse: VolumeResponse = {
        ...mockVolumeResponse,
        volume_type: "EXTERNAL",
        storage_location: "s3://my-bucket/volumes/test_volume",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume creation API call
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .reply(200, externalVolumeResponse);

      // Execute create volume
      const result = await volumesService.createVolume(externalVolumeParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(externalVolumeResponse);
    });

    it("should handle errors when creating a volume", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume creation API call with error
      nock(databricksHost).post(DatabricksVolumesService.VOLUMES_ENDPOINT).reply(400, {
        error_code: "INVALID_PARAMETER_VALUE",
        message: "Volume name already exists in schema",
      });

      // Execute create volume
      const result = await volumesService.createVolume(mockCreateVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create volume");
    });

    it("should handle unauthorized errors when creating a volume", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume creation API call with unauthorized error
      nock(databricksHost).post(DatabricksVolumesService.VOLUMES_ENDPOINT).reply(403, {
        error_code: "PERMISSION_DENIED",
        message: "User does not have CREATE VOLUME privilege on schema",
      });

      // Execute create volume
      const result = await volumesService.createVolume(mockCreateVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create volume");
    });

    it("should handle token fetch failure when creating a volume", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute create volume
      const result = await volumesService.createVolume(mockCreateVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create volume");
    });

    it("should handle network errors during volume creation", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume creation API call with network error
      nock(databricksHost)
        .post(DatabricksVolumesService.VOLUMES_ENDPOINT)
        .replyWithError("Network error");

      // Execute create volume
      const result = await volumesService.createVolume(mockCreateVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create volume");
    });
  });

  describe("getVolume", () => {
    const mockGetVolumeParams: GetVolumeParams = {
      name: "test_catalog.test_schema.test_volume",
    };

    const mockVolumeResponse: VolumeResponse = {
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      name: "test_volume",
      full_name: "test_catalog.test_schema.test_volume",
      volume_id: "12345-abcde-67890-fghij",
      volume_type: "MANAGED",
      comment: "Test volume for experiments",
      metastore_id: "meta-12345",
      owner: "test-user@example.com",
      created_at: 1620000000000,
      created_by: "test-user@example.com",
      updated_at: 1620000000000,
      updated_by: "test-user@example.com",
    };

    it("should successfully get a volume", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(mockGetVolumeParams.name)}`,
        )
        .reply(200, mockVolumeResponse);

      // Execute get volume
      const result = await volumesService.getVolume(mockGetVolumeParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockVolumeResponse);
    });

    it("should successfully get a volume with include_browse parameter", async () => {
      const paramsWithBrowse: GetVolumeParams = {
        ...mockGetVolumeParams,
        include_browse: true,
      };

      const responseWithBrowse: VolumeResponse = {
        ...mockVolumeResponse,
        browse_only: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call with query parameter
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(paramsWithBrowse.name)}`,
        )
        .query({ include_browse: true })
        .reply(200, responseWithBrowse);

      // Execute get volume
      const result = await volumesService.getVolume(paramsWithBrowse);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(responseWithBrowse);
    });

    it("should handle volume not found errors", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call with not found error
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(mockGetVolumeParams.name)}`,
        )
        .reply(404, {
          error_code: "VOLUME_NOT_FOUND",
          message: "Volume test_catalog.test_schema.test_volume not found",
        });

      // Execute get volume
      const result = await volumesService.getVolume(mockGetVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get volume");
    });

    it("should handle permission denied errors when getting a volume", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call with permission denied error
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(mockGetVolumeParams.name)}`,
        )
        .reply(403, {
          error_code: "PERMISSION_DENIED",
          message: "User does not have READ VOLUME privilege",
        });

      // Execute get volume
      const result = await volumesService.getVolume(mockGetVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get volume");
    });

    it("should handle token fetch failure when getting a volume", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute get volume
      const result = await volumesService.getVolume(mockGetVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get volume");
    });

    it("should handle network errors during volume retrieval", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call with network error
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(mockGetVolumeParams.name)}`,
        )
        .replyWithError("Network error");

      // Execute get volume
      const result = await volumesService.getVolume(mockGetVolumeParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get volume");
    });

    it("should properly encode volume names with special characters", async () => {
      const specialVolumeParams: GetVolumeParams = {
        name: "test_catalog.test-schema.test_volume-2024",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock volume get API call with encoded name
      nock(databricksHost)
        .get(
          `${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(specialVolumeParams.name)}`,
        )
        .reply(200, {
          ...mockVolumeResponse,
          name: "test_volume-2024",
          full_name: "test_catalog.test-schema.test_volume-2024",
        });

      // Execute get volume
      const result = await volumesService.getVolume(specialVolumeParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.full_name).toBe("test_catalog.test-schema.test_volume-2024");
    });
  });
});
