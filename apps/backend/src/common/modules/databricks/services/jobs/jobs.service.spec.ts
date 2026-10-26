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

  describe("triggerJob - validateJobRunResponse", () => {
    it("should fail when Databricks returns response without run_id", async () => {
      const jobId = 12345;
      const mockParams = {
        EXPERIMENT_ID: "exp-123",
        USER_ID: "user-456",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now returning response without run_id
      nock(databricksHost)
        .post(DatabricksJobsService.JOBS_ENDPOINT + "/run-now")
        .reply(200, { number_in_job: 1 });

      const result = await jobsService.triggerJob(jobId, mockParams);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job trigger");
    });
  });

  describe("getJobRunStatus", () => {
    it("should successfully get job run status", async () => {
      const runId = 12345;

      const mockResponse = {
        run_id: runId,
        state: { life_cycle_state: "RUNNING", state_message: "" },
        start_time: Date.now(),
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs/get API call
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/get")
        .query({ run_id: runId })
        .reply(200, mockResponse);

      const result = await jobsService.getJobRunStatus(runId);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.run_id).toBe(runId);
      expect(result.value.state.life_cycle_state).toBe("RUNNING");
    });

    it("should handle API errors when getting job run status", async () => {
      const runId = 12345;

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock runs/get API call with error
      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/get")
        .query({ run_id: runId })
        .reply(404, { message: "Run not found" });

      const result = await jobsService.getJobRunStatus(runId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get job run status");
    });

    it("should handle token fetch failure when getting job run status", async () => {
      const runId = 12345;

      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      const result = await jobsService.getJobRunStatus(runId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to get job run status");
    });
  });

  describe("getJobRunOutput", () => {
    it("returns a task run's error and trace", async () => {
      const taskRunId = 907183647783172;

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/get-output")
        .query({ run_id: taskRunId })
        .reply(200, {
          error: "ExportError: EXPORT_ERROR[no_data] nothing to export",
          error_trace: "Traceback (most recent call last): ...",
        });

      const result = await jobsService.getJobRunOutput(taskRunId);

      assertSuccess(result);
      expect(result.value.error).toBe("ExportError: EXPORT_ERROR[no_data] nothing to export");
      expect(result.value.error_trace).toContain("Traceback");
    });

    it("should handle API errors when getting a job run's output", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .get(DatabricksJobsService.JOBS_ENDPOINT + "/runs/get-output")
        .query({ run_id: 1 })
        .reply(400, { message: "Retrieving the output of a job run is not supported" });

      const result = await jobsService.getJobRunOutput(1);

      assertFailure(result);
      expect(result.error.message).toContain("Failed to get job run output");
    });
  });
});
