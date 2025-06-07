import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import nock from "nock";

import { assertFailure, assertSuccess, AppError } from "../../utils/fp-utils";
import { DatabricksService } from "./databricks.service";

describe("DatabricksService", () => {
  let service: DatabricksService;
  let configService: ConfigService;

  const mockConfig = {
    databricksHost: "https://databricks.example.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    jobId: "1234",
    warehouseId: "5678",
    catalogName: "test_catalog",
  };

  const mockJobParams = {
    experimentId: "exp-123",
    experimentName: "Test Experiment",
    userId: "user-123",
  };

  const createMockConfigService = (
    overrides: Partial<typeof mockConfig> = {},
  ) => ({
    getOrThrow: jest.fn(
      (
        key:
          | "databricks.host"
          | "databricks.clientId"
          | "databricks.clientSecret"
          | "databricks.jobId"
          | "databricks.warehouseId"
          | "databricks.catalogName",
        defaultValue?: string,
      ) => {
        const config = { ...mockConfig, ...overrides };
        const configMap = {
          "databricks.host": config.databricksHost,
          "databricks.clientId": config.clientId,
          "databricks.clientSecret": config.clientSecret,
          "databricks.jobId": config.jobId,
          "databricks.warehouseId": config.warehouseId,
          "databricks.catalogName": config.catalogName,
        };
        return configMap[key] || defaultValue;
      },
    ),
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
    nock(mockConfig.databricksHost)
      .post(DatabricksService.TOKEN_ENDPOINT)
      .reply(200, {
        access_token: accessToken,
        expires_in: expiresIn,
      });

  const mockTokenFailure = (
    status = 401,
    errorDescription = "Invalid client credentials",
  ) =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.TOKEN_ENDPOINT)
      .reply(status, { error_description: errorDescription });

  const mockJobRunSuccess = (runId = 12345, numberInJob = 1) =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.JOBS_ENDPOINT)
      .reply(200, {
        run_id: runId,
        number_in_job: numberInJob,
      });

  const mockJobRunFailure = (
    status = 404,
    message = "Job not found or access denied",
  ) =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.JOBS_ENDPOINT)
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

  const mockSqlStatementSuccess = (experimentId = "exp-123") =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .reply(200, {
        statement_id: "statement-123",
        status: {
          state: "SUCCEEDED",
        },
        manifest: {
          schema: {
            column_count: 2,
            columns: [
              {
                name: "id",
                position: 0,
                type_name: "STRING",
                type_text: "STRING",
              },
              {
                name: "value",
                position: 1,
                type_name: "DOUBLE",
                type_text: "DOUBLE",
              },
            ],
          },
          total_row_count: 2,
        },
        result: {
          chunk_index: 0,
          data_array: [
            [experimentId, "123.45"],
            [experimentId, "67.89"],
          ],
          row_count: 2,
          row_offset: 0,
        },
      });

  const mockSqlStatementPendingThenSucceeded = (experimentId = "exp-123") => {
    const pendingScope = nock(mockConfig.databricksHost)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .reply(200, {
        statement_id: "statement-123",
        status: {
          state: "PENDING",
        },
      });

    const successScope = nock(mockConfig.databricksHost)
      .get(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/statement-123`)
      .reply(200, {
        statement_id: "statement-123",
        status: {
          state: "SUCCEEDED",
        },
        manifest: {
          schema: {
            column_count: 2,
            columns: [
              {
                name: "id",
                position: 0,
                type_name: "STRING",
                type_text: "STRING",
              },
              {
                name: "value",
                position: 1,
                type_name: "DOUBLE",
                type_text: "DOUBLE",
              },
            ],
          },
          total_row_count: 2,
        },
        result: {
          chunk_index: 0,
          data_array: [
            [experimentId, "123.45"],
            [experimentId, "67.89"],
          ],
          row_count: 2,
          row_offset: 0,
        },
      });

    return { pendingScope, successScope };
  };

  const mockSqlStatementFailure = (
    status = 400,
    message = "SQL syntax error",
  ) =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .reply(status, { message });

  const mockSqlStatementExecutionFailure = () =>
    nock(mockConfig.databricksHost)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .reply(200, {
        statement_id: "statement-123",
        status: {
          state: "FAILED",
          error: {
            message: "Execution failed: table not found",
            error_code: "TABLE_NOT_FOUND",
          },
        },
      });

  const mockListTablesSuccess = (
    tables = [
      {
        name: "test_table",
        catalog_name: "test_catalog",
        schema_name: "test_schema",
      },
    ],
  ) =>
    nock(mockConfig.databricksHost)
      .get(DatabricksService.TABLES_ENDPOINT)
      .query(true) // Accept any query params
      .reply(200, { tables });

  const mockListTablesFailure = (status = 404, message = "Schema not found") =>
    nock(mockConfig.databricksHost)
      .get(DatabricksService.TABLES_ENDPOINT)
      .query(true) // Accept any query params
      .reply(status, { message });

  const mockPollingNetworkError = () => {
    // Mock for the initial SQL statement request that returns PENDING
    const initialScope = nock(mockConfig.databricksHost)
      .post(DatabricksService.SQL_STATEMENTS_ENDPOINT)
      .reply(200, {
        statement_id: "statement-123",
        status: {
          state: "PENDING",
        },
      });

    // Mock for polling request that fails with a network error
    const pollingScope = nock(mockConfig.databricksHost)
      .get(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/statement-123`)
      .replyWithError("Network error: Connection timeout");

    return { initialScope, pollingScope };
  };

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
        "databricks.warehouseId",
        "databricks.catalogName",
      ];

      expectedCalls.forEach((key) => {
        // eslint-disable-next-line @typescript-eslint/unbound-method
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
        await expect(() =>
          setupModule({
            jobId: "",
            databricksHost: "databricksHost",
            clientId: "clientId",
            clientSecret: "clientSecret",
          }),
        ).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when host is not configured", async () => {
        await expect(() =>
          setupModule({
            jobId: "jobId",
            databricksHost: "",
            clientId: "clientId",
            clientSecret: "clientSecret",
          }),
        ).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when clientId is not configured", async () => {
        await expect(() =>
          setupModule({
            jobId: "jobId",
            databricksHost: "databricksHost",
            clientId: "",
            clientSecret: "clientSecret",
          }),
        ).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when clientSecret is not configured", async () => {
        await expect(() =>
          setupModule({
            jobId: "jobId",
            databricksHost: "databricksHost",
            clientId: "clientId",
            clientSecret: "",
          }),
        ).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when warehouseId is not configured", async () => {
        await expect(() =>
          setupModule({
            jobId: "jobId",
            databricksHost: "databricksHost",
            clientId: "clientId",
            clientSecret: "clientSecret",
            warehouseId: "",
            catalogName: "catalogName",
          }),
        ).rejects.toThrow(
          "Invalid Databricks configuration: all fields must be non-empty strings",
        );
      });

      it("should fail when catalogName is not configured", async () => {
        await expect(() =>
          setupModule({
            jobId: "jobId",
            databricksHost: "databricksHost",
            clientId: "clientId",
            clientSecret: "clientSecret",
            warehouseId: "warehouseId",
            catalogName: "",
          }),
        ).rejects.toThrow(
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

  describe("listTables", () => {
    describe("Success scenarios", () => {
      it("should retrieve tables for an experiment schema", async () => {
        mockTokenResponse();
        mockListTablesSuccess([
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: "exp_test_exp-123",
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: "exp_test_exp-123",
          },
        ]);

        const result = await service.listTables("test", "exp-123");

        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value).toEqual({
          tables: [
            {
              name: "bronze_data",
              catalog_name: "test_catalog",
              schema_name: "exp_test_exp-123",
            },
            {
              name: "silver_data",
              catalog_name: "test_catalog",
              schema_name: "exp_test_exp-123",
            },
          ],
        });
        expect(nock.isDone()).toBeTruthy();
      });

      it("should handle empty tables list", async () => {
        mockTokenResponse();
        mockListTablesSuccess([]);

        const result = await service.listTables("test", "exp-123");

        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value).toEqual({ tables: [] });
      });
    });

    describe("Failure scenarios", () => {
      it("should handle authentication failures", async () => {
        mockTokenFailure();

        const result = await service.listTables("test", "exp-123");

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain("Databricks token request");
      });

      it("should handle API errors when listing tables", async () => {
        mockTokenResponse();
        mockListTablesFailure(404, "Schema not found");

        const result = await service.listTables("test", "exp-123");

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain(
          "Failed to list Databricks tables",
        );
        expect(result.error.message).toContain("Schema not found");
      });
    });
  });

  describe("executeSqlQuery", () => {
    describe("Success scenarios", () => {
      it("should execute SQL query successfully", async () => {
        mockTokenResponse();
        mockSqlStatementSuccess("exp-123");

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value).toEqual({
          columns: [
            { name: "id", type_name: "STRING", type_text: "STRING" },
            { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [
            ["exp-123", "123.45"],
            ["exp-123", "67.89"],
          ],
          totalRows: 2,
          truncated: false,
        });
        expect(nock.isDone()).toBeTruthy();
      });

      it("should handle SQL execution requiring polling", async () => {
        mockTokenResponse();
        const { pendingScope, successScope } =
          mockSqlStatementPendingThenSucceeded("exp-456");

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(pendingScope.isDone()).toBeTruthy();
        expect(successScope.isDone()).toBeTruthy();
        expect(result.isSuccess()).toBe(true);
        assertSuccess(result);
        expect(result.value.rows).toEqual([
          ["exp-456", "123.45"],
          ["exp-456", "67.89"],
        ]);
      });
    });

    describe("Failure scenarios", () => {
      it("should handle authentication failures", async () => {
        mockTokenFailure();

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain("Databricks token request");
        expect(nock.isDone()).toBeTruthy();
      });

      it("should handle SQL statement execution failures", async () => {
        mockTokenResponse();
        mockSqlStatementExecutionFailure();

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain(
          "SQL statement execution failed",
        );
        expect(result.error.message).toContain(
          "Execution failed: table not found",
        );
      });

      it("should handle SQL API errors", async () => {
        mockTokenResponse();
        mockSqlStatementFailure(500, "Internal server error");

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain(
          "Databricks SQL query execution",
        );
      });

      it("should handle network errors during polling", async () => {
        mockTokenResponse();
        const { initialScope, pollingScope } = mockPollingNetworkError();

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(initialScope.isDone()).toBeTruthy();
        expect(pollingScope.isDone()).toBeTruthy();
        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toContain("Databricks SQL polling failed");
      });

      it("should handle AppError in the inner try-catch block", async () => {
        mockTokenResponse();

        // Mock the formatExperimentDataResponse to throw an AppError
        jest
          .spyOn(service as any, "formatExperimentDataResponse")
          .mockImplementationOnce(() => {
            throw AppError.internal("Test AppError");
          });

        mockSqlStatementSuccess();

        const result = await service.executeSqlQuery(
          "test_schema",
          "SELECT * FROM test_table",
        );

        expect(result.isSuccess()).toBe(false);
        assertFailure(result);
        expect(result.error.message).toBe("Test AppError");
      });
    });
  });
});
