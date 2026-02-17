import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksJobsService } from "./jobs.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksJobsService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let jobsService: DatabricksJobsService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    jobsService = testApp.module.get(DatabricksJobsService);

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

  describe("healthCheck", () => {
    it("should return successful health check when Databricks API is available", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock jobs list API call
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(200, {
          jobs: [{ job_id: 12345, settings: { name: "Test Job" } }],
        });

      // Execute health check
      const result = await jobsService.healthCheck();

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        healthy: true,
        service: "databricks",
      });
    });

    it("should return unhealthy status when Databricks API returns error", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock jobs list API call with error
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(500, { error: "Internal Server Error" });

      // Execute health check
      const result = await jobsService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks service unavailable");
    });

    it("should handle token fetch failure during health check", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute health check
      const result = await jobsService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks service unavailable");
    });
  });

  describe("triggerJob", () => {
    it("should successfully trigger a job", async () => {
      const jobId = 12345;
      const experimentId = "exp-123";
      const mockParams = {
        EXPERIMENT_ID: "exp-123",
        EXPERIMENT_SCHEMA: "Test Experiment",
        USER_ID: "user-456",
      };

      const mockResponse = {
        run_id: 12345,
        number_in_job: 1,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request
      nock(databricksHost)
        .post(DatabricksJobsService.JOBS_ENDPOINT + "/run-now")
        .reply(200, mockResponse);

      // Execute trigger job
      const result = await jobsService.triggerJob(jobId, mockParams, experimentId);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API errors when triggering a job", async () => {
      const jobId = 12345;
      const experimentId = "exp-123";
      const mockParams = {
        EXPERIMENT_ID: "exp-123",
        EXPERIMENT_SCHEMA: "Test Experiment",
        USER_ID: "user-456",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request with error
      nock(databricksHost)
        .post(DatabricksJobsService.JOBS_ENDPOINT + "/run-now")
        .reply(400, { message: "Invalid job parameters" });

      // Execute trigger job
      const result = await jobsService.triggerJob(jobId, mockParams, experimentId);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job trigger");
    });

    it("should handle token fetch failure when triggering a job", async () => {
      const jobId = 12345;
      const experimentId = "exp-123";
      const mockParams = {
        EXPERIMENT_ID: "exp-123",
        EXPERIMENT_SCHEMA: "Test Experiment",
        USER_ID: "user-456",
      };

      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute trigger job
      const result = await jobsService.triggerJob(jobId, mockParams, experimentId);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job trigger");
    });
  });

  describe("listRunsForJob", () => {
    it("should successfully list runs for a job", async () => {
      const jobId = 42;

      const mockResponse = {
        runs: [
          {
            run_id: 100,
            job_id: 42,
            number_in_job: 1,
            state: { life_cycle_state: "RUNNING" },
            start_time: Date.now(),
            job_parameters: [
              { name: "EXPERIMENT_ID", value: "exp-123" },
              { name: "TABLE_NAME", value: "raw_data" },
            ],
          },
          {
            run_id: 101,
            job_id: 42,
            number_in_job: 2,
            state: { life_cycle_state: "PENDING" },
            start_time: Date.now(),
            job_parameters: [
              { name: "EXPERIMENT_ID", value: "exp-456" },
              { name: "TABLE_NAME", value: "device" },
            ],
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

      // Mock runs list API call
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/list")
        .query(true)
        .reply(200, mockResponse);

      const result = await jobsService.listRunsForJob(jobId, true);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.runs).toHaveLength(2);
      expect(result.value.has_more).toBe(false);
    });

    it("should handle API errors when listing runs", async () => {
      const jobId = 42;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API call with error
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/list")
        .query(true)
        .reply(500, { message: "Internal server error" });

      const result = await jobsService.listRunsForJob(jobId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list job runs");
    });

    it("should handle token fetch failure when listing runs", async () => {
      const jobId = 42;

      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      const result = await jobsService.listRunsForJob(jobId);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list job runs");
    });

    it("should return empty runs when no runs exist", async () => {
      const jobId = 42;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs list API call with no runs
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/list")
        .query(true)
        .reply(200, {
          has_more: false,
        });

      const result = await jobsService.listRunsForJob(jobId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.runs).toBeUndefined();
      expect(result.value.has_more).toBe(false);
    });
  });
});
