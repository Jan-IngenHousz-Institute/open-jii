import { Logger } from "@nestjs/common";
import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksSqlService } from "./sql.service";
import type { StatementParameter } from "./sql.types";

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

    it("should send statement parameters with the statement", async () => {
      const parameters: StatementParameter[] = [
        { name: "row_id", value: "\\') OR 1=1 --" },
        { name: "now", value: "2026-09-25T02:00:00.000Z", type: "TIMESTAMP" },
      ];

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      const statementCall = nock(databricksHost)
        .post(
          DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/",
          (body: { statement: string; parameters: unknown }) =>
            body.statement === "DELETE FROM t WHERE row_id = :row_id AND ts < :now" &&
            JSON.stringify(body.parameters) === JSON.stringify(parameters),
        )
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: { schema: { column_count: 0, columns: [] }, total_row_count: 0 },
          result: { row_count: 0 },
        });

      const result = await sqlService.executeSqlQuery(
        schemaName,
        "DELETE FROM t WHERE row_id = :row_id AND ts < :now",
        parameters,
      );

      assertSuccess(result);
      expect(statementCall.isDone()).toBe(true);
    });

    it("should ask the warehouse to cancel a statement it cannot finish within 50 s", async () => {
      const statementId = "mock-statement-id";

      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      const statementCall = nock(databricksHost)
        .post(
          DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/",
          (body: { wait_timeout: string; on_wait_timeout: string }) =>
            body.wait_timeout === "50s" && body.on_wait_timeout === "CANCEL",
        )
        .reply(200, {
          statement_id: statementId,
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 1,
              columns: [{ name: "n", type_name: "LONG", type_text: "BIGINT", position: 0 }],
            },
            total_row_count: 1,
            truncated: false,
          },
          result: { data_array: [["1"]], chunk_index: 0, row_count: 1, row_offset: 0 },
        });

      const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      assertSuccess(result);
      expect(statementCall.isDone()).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Warehouse statement completed",
          statementId,
          rowCount: 1,
          truncated: false,
          durationMs: expect.any(Number) as number,
        }),
      );
      logSpy.mockRestore();
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

    it("should return 400 for BAD_REQUEST error from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with BAD_REQUEST error (e.g. unresolved column)
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message:
                "[UNRESOLVED_COLUMN.WITH_SUGGESTION] A column `nonexistent_col` cannot be resolved. Did you mean one of: `id`, `name`?",
              error_code: "BAD_REQUEST",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
      expect(result.error.message).toContain("UNRESOLVED_COLUMN");
    });

    it("should return 400 for BAD_REQUEST error with table not found from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with BAD_REQUEST error (table not found)
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message:
                "[TABLE_OR_VIEW_NOT_FOUND] The table or view `nonexistent_table` cannot be found.",
              error_code: "BAD_REQUEST",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
      expect(result.error.message).toContain("TABLE_OR_VIEW_NOT_FOUND");
    });

    it("should return 400 for INVALID_PARAMETER_VALUE error from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with INVALID_PARAMETER_VALUE error
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message: "Supplied value for a parameter was invalid",
              error_code: "INVALID_PARAMETER_VALUE",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(400);
      expect(result.error.code).toBe("INVALID_SQL_QUERY");
    });

    it("should return 500 for non-client error codes from Databricks", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Non-client error codes are treated as internal errors
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "FAILED",
            error: {
              message: "Something went wrong internally",
              error_code: "INTERNAL_ERROR",
            },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.statusCode).toBe(500);
      expect(result.error.message).toContain("SQL statement execution failed");
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

    it("should report a statement the warehouse cancelled at the deadline as a 504", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // The warehouse answers a wait_timeout cancellation with no error object.
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "CANCELED" },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      assertFailure(result);
      expect(result.error.statusCode).toBe(504);
      expect(result.error.code).toBe("WAREHOUSE_TIMEOUT");
    });

    it("should report a cancellation that says why as a failure, not a timeout", async () => {
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: {
            state: "CANCELED",
            error: { message: "The warehouse was stopped", error_code: "CANCELLED" },
          },
        });

      const result = await sqlService.executeSqlQuery(schemaName, sqlStatement);

      assertFailure(result);
      expect(result.error.statusCode).toBe(500);
      expect(result.error.message).toContain("The warehouse was stopped");
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
