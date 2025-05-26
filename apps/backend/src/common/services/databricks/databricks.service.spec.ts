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

  const mockDatabricksHost = "https://databricks.example.com";
  const mockClientId = "test-client-id";
  const mockClientSecret = "test-client-secret";
  const mockJobId = "1234";

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const configs = {
        "databricks.host": mockDatabricksHost,
        "databricks.clientId": mockClientId,
        "databricks.clientSecret": mockClientSecret,
        "databricks.jobId": mockJobId,
      };
      return configs[key] !== undefined ? configs[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    nock.cleanAll();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabricksService,
        { provide: HttpService, useValue: new HttpService() },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DatabricksService>(DatabricksService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    nock.cleanAll();
    jest.restoreAllMocks();
  });

  describe("configuration", () => {
    it("should load config from ConfigService", () => {
      expect(configService.get).toHaveBeenCalledWith("databricks.host", "");
      expect(configService.get).toHaveBeenCalledWith("databricks.clientId", "");
      expect(configService.get).toHaveBeenCalledWith(
        "databricks.clientSecret",
        "",
      );
      expect(configService.get).toHaveBeenCalledWith("databricks.jobId", "");
    });
  });

  describe("triggerJob", () => {
    it("should trigger a job successfully", async () => {
      // Mock token request
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(200, {
        access_token: "mock-token",
        expires_in: 3600,
      });

      // Mock job run request
      nock(mockDatabricksHost).post("/api/2.2/jobs/run-now").reply(200, {
        run_id: 12345,
        number_in_job: 1,
      });

      const params = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      };

      const result = await service.triggerJob(params);

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        run_id: 12345,
        number_in_job: 1,
      });

      // Verify all nock interceptors were used
      expect(nock.isDone()).toBeTruthy();
    });

    it("should return failure when token request fails", async () => {
      // Mock failed token request
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(401, {
        error_description: "Invalid client credentials",
      });

      const params = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      };

      const result = await service.triggerJob(params);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("UNAUTHORIZED");
      expect(result.error.message).toContain(
        "Databricks authentication failed",
      );
    });

    it("should return failure when job trigger fails", async () => {
      // Mock token success but job trigger failure
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(200, {
        access_token: "mock-token",
        expires_in: 3600,
      });

      // Mock job run failure
      nock(mockDatabricksHost).post("/api/2.2/jobs/run-now").reply(404, {
        message: "Job not found or access denied",
      });

      const params = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      };

      const result = await service.triggerJob(params);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("BAD_REQUEST");
      expect(result.error.message).toContain("Databricks job not found");
    });

    it("should return failure when job ID is not configured", async () => {
      // Create a separate instance with empty job ID
      const moduleWithEmptyConfig: TestingModule =
        await Test.createTestingModule({
          providers: [
            DatabricksService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string, defaultValue?: string) => {
                  if (key === "databricks.jobId") return "";
                  if (key === "databricks.host") return mockDatabricksHost;
                  if (key === "databricks.clientId") return mockClientId;
                  if (key === "databricks.clientSecret")
                    return mockClientSecret;
                  return defaultValue;
                }),
              },
            },
            { provide: HttpService, useValue: new HttpService() },
          ],
        }).compile();

      const serviceWithEmptyJobId =
        moduleWithEmptyConfig.get<DatabricksService>(DatabricksService);

      const params = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      };

      const result = await serviceWithEmptyJobId.triggerJob(params);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain(
        "Databricks job ID not configured",
      );
    });
  });

  describe("healthCheck", () => {
    it("should return healthy when Databricks API is available", async () => {
      // Mock token request
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(200, {
        access_token: "mock-token",
        expires_in: 3600,
      });

      // Mock jobs list request
      nock(mockDatabricksHost)
        .get("/api/2.2/jobs/list")
        .query({ limit: 10 })
        .reply(200, {
          jobs: [{ job_id: 1234, name: "Test Job" }],
        });

      const result = await service.healthCheck();

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        healthy: true,
        service: "databricks",
      });
    });

    it("should return failure when Databricks API is unavailable", async () => {
      // Mock token request
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(200, {
        access_token: "mock-token",
        expires_in: 3600,
      });

      // Mock failed jobs list request
      nock(mockDatabricksHost)
        .get("/api/2.2/jobs/list")
        .query({ limit: 10 })
        .reply(503, {
          message: "Service unavailable",
        });

      const result = await service.healthCheck();

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("Databricks service unavailable");
    });

    it("should return failure when token acquisition fails", async () => {
      // Mock failed token request
      nock(mockDatabricksHost).post("/oidc/v1/token").reply(401, {
        error_description: "Invalid client credentials",
      });

      const result = await service.healthCheck();

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Databricks authentication failed",
      );
    });
  });

  describe("token management", () => {
    it("should cache tokens and reuse them", async () => {
      // Mock token request that should only be called once
      const tokenScope = nock(mockDatabricksHost)
        .post("/oidc/v1/token")
        .once() // Should only be called once
        .reply(200, {
          access_token: "mock-token",
          expires_in: 3600,
        });

      // Mock two job run requests
      const jobRunScope1 = nock(mockDatabricksHost)
        .post("/api/2.2/jobs/run-now")
        .reply(200, {
          run_id: 12345,
          number_in_job: 1,
        });

      const jobRunScope2 = nock(mockDatabricksHost)
        .post("/api/2.2/jobs/run-now")
        .reply(200, {
          run_id: 12346,
          number_in_job: 2,
        });

      // First call should get a token
      await service.triggerJob({
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      });

      // Token request and first job request should be consumed
      expect(tokenScope.isDone()).toBeTruthy();
      expect(jobRunScope1.isDone()).toBeTruthy();

      // Second call should reuse the token
      await service.triggerJob({
        experimentId: "exp-456",
        experimentName: "Another Experiment",
        userId: "user-123",
      });

      // Second job request should be consumed without additional token requests
      expect(jobRunScope2.isDone()).toBeTruthy();

      // No pending mocks should remain
      expect(nock.isDone()).toBeTruthy();
    });

    it("should request a new token after expiration", async () => {
      // First token with short expiration
      const firstTokenScope = nock(mockDatabricksHost)
        .post("/oidc/v1/token")
        .reply(200, {
          access_token: "first-token",
          expires_in: 0, // Immediate expiration
        });

      // First job run
      const firstJobScope = nock(mockDatabricksHost)
        .post("/api/2.2/jobs/run-now", (body) => {
          // Verify this request uses the first token
          expect(body.job_id).toBe(1234);
          return true;
        })
        .reply(200, {
          run_id: 12345,
          number_in_job: 1,
        });

      // Second token request after expiration
      const secondTokenScope = nock(mockDatabricksHost)
        .post("/oidc/v1/token")
        .reply(200, {
          access_token: "second-token",
          expires_in: 3600,
        });

      // Second job run
      const secondJobScope = nock(mockDatabricksHost)
        .post("/api/2.2/jobs/run-now", (body) => {
          // Verify this request uses the second token
          expect(body.job_id).toBe(1234);
          return true;
        })
        .reply(200, {
          run_id: 12346,
          number_in_job: 2,
        });

      // First call should get a token (that immediately expires)
      await service.triggerJob({
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-123",
      });

      expect(firstTokenScope.isDone()).toBeTruthy();
      expect(firstJobScope.isDone()).toBeTruthy();

      // Second call should need a new token
      await service.triggerJob({
        experimentId: "exp-456",
        experimentName: "Another Experiment",
        userId: "user-123",
      });

      // All requests should be consumed
      expect(secondTokenScope.isDone()).toBeTruthy();
      expect(secondJobScope.isDone()).toBeTruthy();
      expect(nock.isDone()).toBeTruthy();
    });
  });
});
