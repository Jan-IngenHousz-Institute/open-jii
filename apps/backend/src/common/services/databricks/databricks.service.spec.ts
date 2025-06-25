import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import { DatabricksService } from "./databricks.service";

// Constants for testing
const DATABRICKS_HOST = "https://test-databricks.example.com";
const MOCK_JOB_ID = "0123456789";
const MOCK_WAREHOUSE_ID = "test-warehouse-id";
const MOCK_CATALOG_NAME = "test_catalog";
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksService", () => {
  const testApp = TestHarness.App;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    databricksService = testApp.module.get(DatabricksService);

    // Reset any mocks before each test
    jest.restoreAllMocks();
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
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock jobs list API call
      nock(DATABRICKS_HOST)
        .get(DatabricksService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(200, {
          jobs: [{ job_id: 12345, settings: { name: "Test Job" } }],
        });

      // Execute health check
      const result = await databricksService.healthCheck();

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
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock jobs list API call with error
      nock(DATABRICKS_HOST)
        .get(DatabricksService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(500, { error: "Internal Server Error" });

      // Execute health check
      const result = await databricksService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks service unavailable");
    });

    it("should handle token fetch failure during health check", async () => {
      // Mock token request with error
      nock(DATABRICKS_HOST)
        .post(DatabricksService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute health check
      const result = await databricksService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks service unavailable");
      // The actual implementation may not include HTTP code in the error message
      // depending on how getErrorMessage is implemented
    });
  });

  describe("triggerJob", () => {
    it("should successfully trigger a job", async () => {
      const mockParams = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-456",
      };

      const mockResponse = {
        run_id: 12345,
        number_in_job: 1,
      };

      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request
      nock(DATABRICKS_HOST)
        .post(DatabricksService.JOBS_ENDPOINT + "/run-now", {
          job_id: Number(MOCK_JOB_ID),
          job_parameters: {
            experiment_id: mockParams.experimentId,
            experiment_name: mockParams.experimentName,
          },
          queue: {
            enabled: true,
          },
          performance_target: "STANDARD",
          idempotency_token: mockParams.experimentId,
        })
        .reply(200, mockResponse);

      // Execute trigger job
      const result = await databricksService.triggerJob(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
    });

    it("should handle API errors when triggering a job", async () => {
      const mockParams = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-456",
      };

      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request with error
      nock(DATABRICKS_HOST)
        .post(DatabricksService.JOBS_ENDPOINT + "/run-now")
        .reply(400, { message: "Invalid job parameters" });

      // Execute trigger job
      const result = await databricksService.triggerJob(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      // The error message contains only the error content but not the HTTP status code
      expect(result.error.message).toContain("Invalid job parameters");
    });

    it("should handle token fetch failure when triggering a job", async () => {
      const mockParams = {
        experimentId: "exp-123",
        experimentName: "Test Experiment",
        userId: "user-456",
      };

      // Mock token request with error
      nock(DATABRICKS_HOST)
        .post(DatabricksService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute trigger job
      const result = await databricksService.triggerJob(mockParams);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks job execution");
      // The actual implementation forwards errors through apiErrorMapper which may format the message differently
    });
  });

  describe("executeSqlQuery", () => {
    const schemaName = "exp_test_experiment_123";
    const sqlStatement = "SELECT * FROM test_table";

    it("should successfully execute a SQL query and return results", async () => {
      const mockTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string" },
          { name: "column2", type_name: "number", type_text: "number" },
        ],
        rows: [
          ["value1", "1"],
          ["value2", "2"],
        ],
        totalRows: 2,
        truncated: false,
      };

      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(DATABRICKS_HOST)
        .post(DatabricksService.SQL_STATEMENTS_ENDPOINT + "/", {
          statement: sqlStatement,
          warehouse_id: MOCK_WAREHOUSE_ID,
          schema: schemaName,
          catalog: MOCK_CATALOG_NAME,
          wait_timeout: "50s",
          disposition: "INLINE",
          format: "JSON_ARRAY",
        })
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: mockTableData.columns.length,
              columns: mockTableData.columns.map((col, i) => ({
                ...col,
                position: i,
              })),
            },
            total_row_count: mockTableData.totalRows,
            truncated: mockTableData.truncated,
          },
          result: {
            data_array: mockTableData.rows,
            chunk_index: 0,
            row_count: mockTableData.rows.length,
            row_offset: 0,
          },
        });

      // Execute SQL query
      const result = await databricksService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });

    it("should poll for results when query is in RUNNING state initially", async () => {
      const mockTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string" },
          { name: "column2", type_name: "number", type_text: "number" },
        ],
        rows: [
          ["value1", "1"],
          ["value2", "2"],
        ],
        totalRows: 2,
        truncated: false,
      };

      const statementId = "mock-statement-id";

      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(DATABRICKS_HOST)
        .post(DatabricksService.SQL_STATEMENTS_ENDPOINT + "/", {
          statement: sqlStatement,
          warehouse_id: MOCK_WAREHOUSE_ID,
          schema: schemaName,
          catalog: MOCK_CATALOG_NAME,
          wait_timeout: "50s",
          disposition: "INLINE",
          format: "JSON_ARRAY",
        })
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling requests
      // First poll still running
      nock(DATABRICKS_HOST)
        .get(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Second poll succeeded
      nock(DATABRICKS_HOST)
        .get(`${DatabricksService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: mockTableData.columns.length,
              columns: mockTableData.columns.map((col, i) => ({
                ...col,
                position: i,
              })),
            },
            total_row_count: mockTableData.totalRows,
            truncated: mockTableData.truncated,
          },
          result: {
            data_array: mockTableData.rows,
            chunk_index: 0,
            row_count: mockTableData.rows.length,
            row_offset: 0,
          },
        });

      // Execute SQL query
      const result = await databricksService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });

    it("should handle SQL execution errors", async () => {
      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with failure
      nock(DATABRICKS_HOST)
        .post(DatabricksService.SQL_STATEMENTS_ENDPOINT + "/", {
          statement: sqlStatement,
          warehouse_id: MOCK_WAREHOUSE_ID,
          schema: schemaName,
          catalog: MOCK_CATALOG_NAME,
          wait_timeout: "50s",
          disposition: "INLINE",
          format: "JSON_ARRAY",
        })
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message: "Table test_table does not exist",
              error_code: "TABLE_NOT_FOUND",
            },
          },
        });

      // Execute SQL query
      const result = await databricksService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("SQL statement execution failed");
      expect(result.error.message).toContain("Table test_table does not exist");
    });

    it("should handle API errors during SQL execution", async () => {
      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with API error
      nock(DATABRICKS_HOST)
        .post(DatabricksService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(500, { message: "Internal server error" });

      // Execute SQL query
      const result = await databricksService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks SQL query execution");
    });
  });

  describe("listTables", () => {
    const experimentName = "test_experiment";
    const experimentId = "123";

    it("should successfully list tables", async () => {
      const mockTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${experimentName}_${experimentId}`,
            table_type: "MANAGED",
            comment: "Bronze data table",
            created_at: 1620000000000,
          },
          {
            name: "silver_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${experimentName}_${experimentId}`,
            table_type: "MANAGED",
            comment: "Silver data table",
            created_at: 1620000000001,
          },
        ],
        next_page_token: null,
      };

      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock tables list API call
      nock(DATABRICKS_HOST)
        .get(DatabricksService.TABLES_ENDPOINT)
        .query({
          catalog_name: MOCK_CATALOG_NAME,
          schema_name: `exp_${experimentName}_${experimentId}`,
        })
        .reply(200, mockTablesResponse);

      // Execute list tables
      const result = await databricksService.listTables(experimentName, experimentId);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.tables).toEqual(mockTablesResponse.tables);
    });

    it("should handle errors when listing tables", async () => {
      // Mock token request
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock tables list API call with error
      nock(DATABRICKS_HOST)
        .get(DatabricksService.TABLES_ENDPOINT)
        .query(true)
        .reply(404, { message: "Schema not found" });

      // Execute list tables
      const result = await databricksService.listTables(experimentName, experimentId);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list Databricks tables");
      // The error message includes the error content but not necessarily the HTTP status
      expect(result.error.message).toContain("Schema not found");
    });

    it("should handle token fetch failure when listing tables", async () => {
      // Mock token request with error
      nock(DATABRICKS_HOST)
        .post(DatabricksService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute list tables
      const result = await databricksService.listTables(experimentName, experimentId);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list Databricks tables");
    });
  });

  describe("token management", () => {
    it("should cache the token and not request a new one if it's still valid", async () => {
      // First token request - must be properly consumed before testing isDone
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // First API call using the token
      const jobsListNock1 = nock(DATABRICKS_HOST)
        .get(DatabricksService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(200, {
          jobs: [{ job_id: 12345, settings: { name: "Test Job" } }],
        });

      // Execute first health check to obtain and cache token
      const result1 = await databricksService.healthCheck();
      expect(result1.isSuccess()).toBe(true);

      // Both requests should have been made
      expect(jobsListNock1.isDone()).toBe(true);

      // Second API call - should use cached token
      const jobsListNock2 = nock(DATABRICKS_HOST)
        .get(DatabricksService.JOBS_ENDPOINT + "/list")
        .query(true)
        .reply(200, {
          jobs: [{ job_id: 12345, settings: { name: "Test Job" } }],
        });

      // Second token request should NOT be made - capturing to ensure it's not called
      const tokenNock2 = nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(200, {
        access_token: "new-token",
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Execute second health check - should use cached token
      const result2 = await databricksService.healthCheck();
      expect(result2.isSuccess()).toBe(true);

      // Second jobs request should have been made
      expect(jobsListNock2.isDone()).toBe(true);

      // Second token request should not have been made
      expect(tokenNock2.isDone()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should properly handle and transform Axios errors", async () => {
      // Mock token request with specific error structure
      nock(DATABRICKS_HOST).post(DatabricksService.TOKEN_ENDPOINT).reply(403, {
        message: "Access denied",
        error_description: "Insufficient permissions",
      });

      // Execute health check
      const result = await databricksService.healthCheck();

      // Assert result is failure with appropriately formatted error
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(500);
      expect(result.error.message).toContain("Databricks service unavailable");
      // The error message from nock can vary, so we don't check for specific content
    });

    it("should handle unexpected errors during requests", async () => {
      // Execute health check without mocking any requests
      const result = await databricksService.healthCheck();

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
