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

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
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

    it("should successfully execute SQL query with EXTERNAL_LINKS disposition", async () => {
      const mockDownloadData = {
        external_links: [
          {
            chunk_index: 0,
            row_count: 1000,
            row_offset: 0,
            byte_count: 5242880,
            external_link: "https://databricks-presigned-url.com/chunk0",
            expiration: "2024-01-15T12:00:00.000Z",
          },
          {
            chunk_index: 1,
            row_count: 500,
            row_offset: 1000,
            byte_count: 2621440,
            external_link: "https://databricks-presigned-url.com/chunk1",
            expiration: "2024-01-15T12:00:00.000Z",
          },
        ],
        totalRows: 1500,
        format: "JSON_ARRAY",
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution with EXTERNAL_LINKS disposition
      nock(databricksHost)
        .post(DatabricksSqlService.SQL_STATEMENTS_ENDPOINT + "/")
        .reply(200, {
          statement_id: "mock-statement-id",
          status: { state: "SUCCEEDED" },
          manifest: {
            schema: {
              column_count: 2,
              columns: [
                { name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 },
                { name: "measurement", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 },
              ],
            },
            total_row_count: mockDownloadData.totalRows,
            format: mockDownloadData.format,
          },
          result: {
            external_links: mockDownloadData.external_links,
            chunk_index: 0,
            row_count: 0,
            row_offset: 0,
          },
        });

      // Execute SQL query with EXTERNAL_LINKS disposition
      const result = await sqlService.executeSqlQuery(
        schemaName,
        sqlStatement,
        "EXTERNAL_LINKS",
        "JSON_ARRAY",
      );

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockDownloadData);
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
      expect(result.error.message).toContain("Databricks SQL query execution");
    });
  });
});
