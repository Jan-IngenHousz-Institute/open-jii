import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksPipelinesService } from "./pipelines.service";
import type {
  DatabricksPipelineGetParams,
  DatabricksPipelineListParams,
  DatabricksPipelineStartUpdateParams,
} from "./pipelines.types";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;
const MOCK_PIPELINE_ID = "mock-pipeline-id";
const MOCK_PIPELINE_NAME = "Mock Pipeline";
const MOCK_UPDATE_ID = "mock-update-id";

describe("DatabricksPipelinesService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let pipelinesService: DatabricksPipelinesService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    pipelinesService = testApp.module.get(DatabricksPipelinesService);

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

  describe("listPipelines", () => {
    it("should successfully list pipelines", async () => {
      const mockParams: DatabricksPipelineListParams = {
        maxResults: 10,
      };

      const mockResponse = {
        pipelines: [
          {
            pipeline_id: MOCK_PIPELINE_ID,
            name: MOCK_PIPELINE_NAME,
            state: "ACTIVE",
            creator_user_name: "test-user",
            created_time: 1629123456789,
            last_modified_time: 1629123456789,
          },
        ],
        has_more: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list request
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query({ max_results: 10 })
        .reply(200, mockResponse);

      // Execute list pipelines
      const result = await pipelinesService.listPipelines(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API errors when listing pipelines", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list request with error
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .reply(500, { error: "Internal Server Error" });

      // Execute list pipelines
      const result = await pipelinesService.listPipelines();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks pipelines list");
    });
  });

  describe("getPipeline", () => {
    it("should successfully get pipeline details", async () => {
      const mockParams: DatabricksPipelineGetParams = {
        pipelineId: MOCK_PIPELINE_ID,
      };

      const mockResponse = {
        pipeline_id: MOCK_PIPELINE_ID,
        name: MOCK_PIPELINE_NAME,
        creator_user_name: "test-user",
        created_time: 1629123456789,
        last_modified_time: 1629123456789,
        spec: {
          id: "spec-id",
          name: MOCK_PIPELINE_NAME,
          storage: "dbfs:/pipelines/mock-storage",
        },
        status: {
          maturity_level: "PRODUCTION",
        },
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline get request
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}`)
        .reply(200, mockResponse);

      // Execute get pipeline
      const result = await pipelinesService.getPipeline(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API errors when getting pipeline details", async () => {
      const mockParams: DatabricksPipelineGetParams = {
        pipelineId: MOCK_PIPELINE_ID,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline get request with error
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}`)
        .reply(404, { error: "Pipeline not found" });

      // Execute get pipeline
      const result = await pipelinesService.getPipeline(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks pipeline get");
    });

    it("should handle invalid pipeline responses", async () => {
      const mockParams: DatabricksPipelineGetParams = {
        pipelineId: MOCK_PIPELINE_ID,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline get request with invalid response (missing pipeline_id)
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}`)
        .reply(200, {
          name: MOCK_PIPELINE_NAME,
          // Missing pipeline_id field
        });

      // Execute get pipeline
      const result = await pipelinesService.getPipeline(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Invalid response from Databricks API: missing pipeline_id",
      );
    });
  });

  describe("getPipelineByName", () => {
    it("should successfully get pipeline by name", async () => {
      const mockListResponse = {
        pipelines: [
          {
            pipeline_id: MOCK_PIPELINE_ID,
            name: MOCK_PIPELINE_NAME,
            state: "ACTIVE",
            creator_user_name: "test-user",
            created_time: 1629123456789,
            last_modified_time: 1629123456789,
          },
        ],
        has_more: false,
      };

      const mockGetResponse = {
        pipeline_id: MOCK_PIPELINE_ID,
        name: MOCK_PIPELINE_NAME,
        creator_user_name: "test-user",
        created_time: 1629123456789,
        last_modified_time: 1629123456789,
        spec: {
          id: "spec-id",
          name: MOCK_PIPELINE_NAME,
          storage: "dbfs:/pipelines/mock-storage",
        },
        status: {
          maturity_level: "PRODUCTION",
        },
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list request
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .reply(200, mockListResponse);

      // Mock pipeline get request
      nock(databricksHost)
        .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}`)
        .reply(200, mockGetResponse);

      // Execute get pipeline by name
      const result = await pipelinesService.getPipelineByName({ pipelineName: MOCK_PIPELINE_NAME });

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockGetResponse);
    });

    it("should handle pipeline not found by name", async () => {
      const mockListResponse = {
        pipelines: [
          {
            pipeline_id: "other-pipeline-id",
            name: "Other Pipeline",
            state: "ACTIVE",
            creator_user_name: "test-user",
            created_time: 1629123456789,
            last_modified_time: 1629123456789,
          },
        ],
        has_more: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list request
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .reply(200, mockListResponse);

      // Execute get pipeline by name
      const result = await pipelinesService.getPipelineByName({ pipelineName: MOCK_PIPELINE_NAME });

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        `Pipeline with name '${MOCK_PIPELINE_NAME}' not found`,
      );
    });
  });

  describe("startPipelineUpdate", () => {
    it("should successfully start a pipeline update", async () => {
      const mockParams: DatabricksPipelineStartUpdateParams = {
        pipelineId: MOCK_PIPELINE_ID,
        fullRefresh: true,
      };

      const mockResponse = {
        update_id: MOCK_UPDATE_ID,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline start update request
      nock(databricksHost)
        .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}/updates`)
        .reply(200, mockResponse);

      // Execute start pipeline update
      const result = await pipelinesService.startPipelineUpdate(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API errors when starting pipeline update", async () => {
      const mockParams: DatabricksPipelineStartUpdateParams = {
        pipelineId: MOCK_PIPELINE_ID,
        fullRefresh: true,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline start update request with error
      nock(databricksHost)
        .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}/updates`)
        .reply(400, { error: "Bad Request" });

      // Execute start pipeline update
      const result = await pipelinesService.startPipelineUpdate(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks pipeline start update");
    });

    it("should handle invalid start update responses", async () => {
      const mockParams: DatabricksPipelineStartUpdateParams = {
        pipelineId: MOCK_PIPELINE_ID,
        fullRefresh: true,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipeline start update request with invalid response (missing update_id)
      nock(databricksHost)
        .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${MOCK_PIPELINE_ID}/updates`)
        .reply(200, {});

      // Execute start pipeline update
      const result = await pipelinesService.startPipelineUpdate(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Invalid response from Databricks API: missing update_id",
      );
    });
  });

  describe("healthCheck", () => {
    it("should return successful health check when Databricks Pipelines API is available", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list API call for health check
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query({ max_results: 1 })
        .reply(200, {
          pipelines: [],
          has_more: false,
        });

      // Execute health check
      const result = await pipelinesService.healthCheck();

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        healthy: true,
        service: "databricks-pipelines",
      });
    });

    it("should return unhealthy status when Databricks Pipelines API returns error", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock pipelines list API call with error
      nock(databricksHost)
        .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
        .query({ max_results: 1 })
        .reply(500, { error: "Internal Server Error" });

      // Execute health check
      const result = await pipelinesService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks Pipelines service unavailable");
    });

    it("should handle token fetch failure during health check", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute health check
      const result = await pipelinesService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks Pipelines service unavailable");
    });
  });
});
