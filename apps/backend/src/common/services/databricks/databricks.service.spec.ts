import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import nock from "nock";

import {
  AppError,
  assertFailure,
  assertSuccess,
} from "../../../experiments/utils/fp-utils";
import { DatabricksService } from "./databricks.service";

describe("DatabricksService", () => {
  let service: DatabricksService;
  let configService: ConfigService;

  const mockConfig = {
    databricksHost: "https://databricks.example.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    jobId: "1234",
  };

  const mockJobParams = {
    experimentId: "exp-123",
    experimentName: "Test Experiment",
    userId: "user-123",
  };

  const createMockConfigService = (
    overrides: Partial<typeof mockConfig> = {},
  ) => ({
    getOrThrow: jest.fn((key: string, defaultValue?: string) => {
      const config = { ...mockConfig, ...overrides };
      const configMap = {
        "databricks.host": config.databricksHost,
        "databricks.clientId": config.clientId,
        "databricks.clientSecret": config.clientSecret,
        "databricks.jobId": config.jobId,
      };
      return configMap[key] ?? defaultValue;
    }),
  });

  const setupModule = async (configOverrides?: Partial<typeof mockConfig>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabricksService,
        { provide: HttpService, useValue: new HttpService() },
        {
          provide: ConfigService,
          useValue: createMockConfigService(configOverrides),
        },
      ],
    }).compile();

    return {
      service: module.get<DatabricksService>(DatabricksService),
      configService: module.get<ConfigService>(ConfigService),
    };
  };

  const mockTokenResponse = (accessToken = "mock-token", expiresIn = 3600) =>
    nock(mockConfig.databricksHost).post("/oidc/v1/token").reply(200, {
      access_token: accessToken,
      expires_in: expiresIn,
    });

  const mockTokenFailure = (
    status = 401,
    errorDescription = "Invalid client credentials",
  ) =>
    nock(mockConfig.databricksHost)
      .post("/oidc/v1/token")
      .reply(status, { error_description: errorDescription });

  const mockJobRunSuccess = (runId = 12345, numberInJob = 1) =>
    nock(mockConfig.databricksHost).post("/api/2.2/jobs/run-now").reply(200, {
      run_id: runId,
      number_in_job: numberInJob,
    });

  const mockJobRunFailure = (
    status = 404,
    message = "Job not found or access denied",
  ) =>
    nock(mockConfig.databricksHost)
      .post("/api/2.2/jobs/run-now")
      .reply(status, { message });

  const mockJobsListSuccess = (jobs = [{ job_id: 1234, name: "Test Job" }]) =>
    nock(mockConfig.databricksHost)
      .get("/api/2.2/jobs/list")
      .query({ limit: 1, expand_tasks: false })
      .reply(200, { jobs });

  const mockJobsListFailure = (status = 503, message = "Service unavailable") =>
    nock(mockConfig.databricksHost)
      .get("/api/2.2/jobs/list")
      .query({ limit: 1, expand_tasks: false })
      .reply(status, { message });

  beforeEach(async () => {
    jest.clearAllMocks();
    nock.cleanAll();

    const moduleSetup = await setupModule();
    service = moduleSetup.service;
    configService = moduleSetup.configService;
  });

  afterEach(() => {
    nock.cleanAll();
    jest.restoreAllMocks();
  });

  describe("Configuration", () => {
    it("should load all required configuration values", () => {
      const expectedCalls = [
        "databricks.host",
        "databricks.clientId",
        "databricks.clientSecret",
        "databricks.jobId",
      ];

      expectedCalls.forEach((key) => {
        expect(configService.getOrThrow).toHaveBeenCalledWith(key);
      });
    });
  });

  describe("triggerJob", () => {
    describe("Success scenarios", () => {
      it("should trigger a job successfully with valid parameters", async () => {
        mockTokenResponse();
        mockJobRunSuccess();

        const result = await service.triggerJob(mockJobParams);

        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value).toEqual({
          run_id: 12345,
          number_in_job: 1,
        });
        expect(nock.isDone()).toBeTruthy();
      });

      it("should handle custom run IDs and job numbers", async () => {
        const customRunId = 99999;
        const customJobNumber = 5;

        mockTokenResponse();
        mockJobRunSuccess(customRunId, customJobNumber);

        const result = await service.triggerJob(mockJobParams);

        assertSuccess(result);
        expect(result.value).toEqual({
          run_id: customRunId,
          number_in_job: customJobNumber,
        });
      });
    });

    describe("Authentication failures", () => {
      it("should handle token request failures", async () => {
        mockTokenFailure();

        const result = await service.triggerJob(mockJobParams);

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.code).toBe("UNAUTHORIZED");
        expect(result.error.message).toContain(
          "Databricks token request: Invalid client credentials",
        );
      });

      it("should handle different authentication error responses", async () => {
        mockTokenFailure(403, "Access forbidden");

        const result = await service.triggerJob(mockJobParams);

        assertFailure(result);
        expect(result.error.message).toContain(
          "Databricks token request: Access forbidden",
        );
      });
    });

    describe("Job execution failures", () => {
      it("should handle job not found errors", async () => {
        mockTokenResponse();
        mockJobRunFailure();

        const result = await service.triggerJob(mockJobParams);

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toContain("Databricks job execution");
      });

      it("should handle different job execution error statuses", async () => {
        mockTokenResponse();
        mockJobRunFailure(500, "Internal server error");

        const result = await service.triggerJob(mockJobParams);

        assertFailure(result);
        expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
      });
    });

    describe("Configuration validation", () => {
      it("should fail when job ID is not configured", async () => {
        expect(() => setupModule({ jobId: "" })).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when host is not configured", async () => {
        expect(() => setupModule({ databricksHost: "" })).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });
    });
  });

  describe("healthCheck", () => {
    describe("Success scenarios", () => {
      it("should return healthy when Databricks API is available", async () => {
        mockTokenResponse();
        mockJobsListSuccess();

        const result = await service.healthCheck();

        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value).toEqual({
          healthy: true,
          service: "databricks",
        });
        expect(nock.isDone()).toBeTruthy();
      });

      it("should handle empty jobs list response", async () => {
        mockTokenResponse();
        mockJobsListSuccess([]);

        const result = await service.healthCheck();

        assertSuccess(result);
        expect(result.value.healthy).toBe(true);
      });
    });

    describe("Failure scenarios", () => {
      it("should return failure when Databricks API is unavailable", async () => {
        mockTokenResponse();
        mockJobsListFailure();

        const result = await service.healthCheck();

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.code).toBe("SERVICE_UNAVAILABLE");
        expect(result.error.message).toContain(
          "Databricks service unavailable",
        );
      });

      it("should return failure when token acquisition fails", async () => {
        mockTokenFailure();

        const result = await service.healthCheck();

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain(
          "Databricks token request: Invalid client credentials",
        );
      });
    });
  });

  describe("Token Management", () => {
    it("should cache tokens and reuse them for multiple requests", async () => {
      const tokenScope = mockTokenResponse().persist(false);
      mockJobRunSuccess(12345, 1);
      mockJobRunSuccess(12346, 2);

      // First call should get a token
      await service.triggerJob(mockJobParams);
      expect(tokenScope.isDone()).toBeTruthy();

      // Second call should reuse the token (no additional token requests)
      await service.triggerJob({
        ...mockJobParams,
        experimentId: "exp-456",
      });

      expect(nock.isDone()).toBeTruthy();
    });

    it("should request a new token after expiration", async () => {
      // First token with short expiration
      const firstTokenScope = mockTokenResponse("first-token", 1);
      const firstJobScope = mockJobRunSuccess(12345, 1);

      // Second token after expiration
      const secondTokenScope = mockTokenResponse("second-token", 3600);
      const secondJobScope = mockJobRunSuccess(12346, 2);

      // First call with token that will expire soon
      await service.triggerJob(mockJobParams);
      expect(firstTokenScope.isDone()).toBeTruthy();
      expect(firstJobScope.isDone()).toBeTruthy();

      // Advance time to ensure token expires
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 7200 * 1000); // 2 hours later

      // Second call should need a new token
      await service.triggerJob({
        ...mockJobParams,
        experimentId: "exp-456",
      });

      expect(secondTokenScope.isDone()).toBeTruthy();
      expect(secondJobScope.isDone()).toBeTruthy();

      // Restore Date.now
      jest.restoreAllMocks();
    });

    it("should handle token refresh failures gracefully", async () => {
      // First successful token with normal expiration
      mockTokenResponse("first-token", 3600);
      mockJobRunSuccess();

      // Failed token refresh for second call
      mockTokenFailure();

      // First call succeeds
      const firstResult = await service.triggerJob(mockJobParams);
      assertSuccess(firstResult);

      // Manually expire the token by advancing time
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 7200 * 1000); // 2 hours later

      // Second call fails due to token refresh failure
      const secondResult = await service.triggerJob({
        ...mockJobParams,
        experimentId: "exp-456",
      });
      assertFailure(secondResult);

      // Restore Date.now
      jest.restoreAllMocks();
    });
  });
});
