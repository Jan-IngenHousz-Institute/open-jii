import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksFilesService } from "./files.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;
const MOCK_SCHEMA_NAME = "exp_test_experiment";
const MOCK_CATALOG_NAME = "main";
const MOCK_SOURCE_TYPE = "ambyte";
const MOCK_FILE_NAME = "test-file.csv";
const MOCK_FILE_BUFFER = Buffer.from("test,data,content");

describe("DatabricksFilesService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let filesService: DatabricksFilesService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    filesService = testApp.module.get(DatabricksFilesService);

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

  describe("upload", () => {
    it("should successfully upload a file to a specified path", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload request
      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-uploads/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
        .query({ overwrite: "false" })
        .reply(200);

      // Execute upload
      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        filePath: expectedPath,
      });
    });

    it("should handle API errors when uploading a file", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file upload request with error
      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-uploads/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;
      nock(databricksHost)
        .put(`${DatabricksFilesService.FILES_ENDPOINT}${expectedPath}`)
        .query({ overwrite: "false" })
        .reply(500, { error: "Internal Server Error" });

      // Execute upload
      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      // Assert result is failure
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to upload file to Databricks");
    });

    it("should handle token fetch failure when uploading a file", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      const expectedPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-uploads/${MOCK_SOURCE_TYPE}/${MOCK_FILE_NAME}`;

      const result = await filesService.upload(expectedPath, MOCK_FILE_BUFFER);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to upload file to Databricks");
    });
  });

  describe("download", () => {
    const downloadPath = `/Volumes/${MOCK_CATALOG_NAME}/${MOCK_SCHEMA_NAME}/data-exports/exp-123/raw_data/csv/export-1/raw_data.csv`;

    it("should successfully download a file as a stream", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file download request
      nock(databricksHost)
        .get(`${DatabricksFilesService.FILES_ENDPOINT}${downloadPath}`)
        .reply(200, "csv-file-content", { "content-type": "text/csv" });

      const result = await filesService.download(downloadPath);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeDefined();
    });

    it("should handle API errors when downloading a file", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock file download request with error
      nock(databricksHost)
        .get(`${DatabricksFilesService.FILES_ENDPOINT}${downloadPath}`)
        .reply(404, { error: "File not found" });

      const result = await filesService.download(downloadPath);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to download file from Databricks");
    });

    it("should handle token fetch failure when downloading a file", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      const result = await filesService.download(downloadPath);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to download file from Databricks");
    });
  });
});
