import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksSqlService } from "./sql.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksSqlService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let sqlService: DatabricksSqlService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    sqlService = testApp.module.get(DatabricksSqlService);

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

  describe("executeSqlQuery", () => {
    const schemaName = "exp_test_experiment_123";
    const sqlStatement = "SELECT * FROM test_table";

    it("should successfully execute a SQL query and return results", async () => {
      const mockTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string", position: 0 },
          { name: "column2", type_name: "number", type_text: "number", position: 1 },
        ],
        rows: [
          ["value1", "1"],
          ["value2", "2"],
        ],
        totalRows: 2,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
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
      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });

    it("should poll for results when query is in RUNNING state initially", async () => {
      const mockTableData = {
        columns: [
          { name: "column1", type_name: "string", type_text: "string", position: 0 },
          { name: "column2", type_name: "number", type_text: "number", position: 1 },
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
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling requests
      // First poll still running
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Second poll succeeded
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
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
      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });

    it("should handle SQL execution errors", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with failure
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
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
      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is failure with 500 (unknown error code)
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("SQL statement execution failed");
      expect(result.error.statusCode).toBe(500);
    });

    it("should return 400 for UNRESOLVED_COLUMN error from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with UNRESOLVED_COLUMN error
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message:
                "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column `nonexistent_col` cannot be resolved. Did you mean one of: `id`, `name`?",
              error_code: "UNRESOLVED_COLUMN.WITH_SUGGESTION",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
      expect(result.error.message).toContain("SQL query references invalid columns or tables");
      expect(result.error.message).toContain("UNRESOLVED_COLUMN");
    });

    it("should return 400 for TABLE_OR_VIEW_NOT_FOUND error from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with TABLE_OR_VIEW_NOT_FOUND error
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message:
                "[TABLE_OR_VIEW_NOT_FOUND] The table or view `nonexistent_table` cannot be found.",
              error_code: "TABLE_OR_VIEW_NOT_FOUND",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
      expect(result.error.message).toContain("SQL query references invalid columns or tables");
    });

    it("should return 400 for UNRESOLVED_COLUMN error during polling", async () => {
      const statementId = "mock-statement-id";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling returning FAILED with UNRESOLVED_COLUMN error
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: {
            state: "FAILED",
            error: {
              message: "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column `bad_col` cannot be resolved.",
              error_code: "UNRESOLVED_COLUMN.WITH_SUGGESTION",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
    });

    it("should handle API errors during SQL execution", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with API error
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(500, { message: "Internal server error" });

      // Execute SQL query
      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks SQL query execution");
    });

    it("should handle CANCELED state without error details", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution returning CANCELED without an error object
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "CANCELED" },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("SQL statement execution canceled");
    });

    it("should handle FAILED state during polling", async () => {
      const statementId = "mock-statement-id";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling returning FAILED with error
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: {
            state: "FAILED",
            error: { message: "Query timed out" },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("SQL statement execution failed");
    });

    it("should handle CANCELED state during polling without error details", async () => {
      const statementId = "mock-statement-id";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling returning CANCELED without error
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(200, {
          statement_id: statementId,
          status: { state: "CANCELED" },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("SQL statement execution canceled");
    });

    it("should handle HTTP error during polling", async () => {
      const statementId = "mock-statement-id";

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock initial SQL statement submission with RUNNING status
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: statementId,
          status: { state: "RUNNING" },
        });

      // Mock polling with HTTP error
      nock(databricksHost)
        .get(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`)
        .reply(500, { message: "Internal server error" });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Databricks SQL polling failed");
    });

    it("should handle missing manifest in SUCCEEDED response", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution returning SUCCEEDED but without manifest
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid SQL statement response");
    });

    it("should handle token fetch failure", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute SQL query
      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Invalid client credentials");
    });

    it("should successfully execute a SQL query with DDL statement and return results", async () => {
      const ddlSqlStatement = "CREATE TABLE test_table (column1 STRING, column2 INT)";
      const mockTableData = {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 0,
            },
            total_row_count: 0,
            truncated: false,
          },
          result: {
            data_array: 0,
            chunk_index: 0,
            row_count: 0,
            row_offset: 0,
          },
        });

      // Execute SQL query
      const result = await sqlService.executeSqlQuery(schemaName, ddlSqlStatement);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockTableData);
    });
  });
});
