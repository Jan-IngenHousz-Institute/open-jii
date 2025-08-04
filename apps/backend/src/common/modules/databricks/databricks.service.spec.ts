import nock from "nock";

import { TestHarness } from "../../../test/test-harness";
import { assertSuccess } from "../../utils/fp-utils";
import { DatabricksService } from "./databricks.service";
import { DatabricksAuthService } from "./services/auth/auth.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    databricksService = testApp.module.get(DatabricksService);

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
        .get(/\/api\/2\.2\/jobs\/list/)
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
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock job run-now request
      nock(databricksHost)
        .post(/\/api\/2\.2\/jobs\/run-now/)
        .reply(200, mockResponse);

      // Execute trigger job
      const result = await databricksService.triggerJob(mockParams);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual(mockResponse);
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
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock SQL statement execution
      nock(databricksHost)
        .post(/\/api\/2\.0\/sql\/statements\//)
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
  });

  describe("listTables", () => {
    const experimentName = "test_experiment";
    const experimentId = "123";
    const schemaName = `exp_${experimentName}_${experimentId}`;

    it("should successfully list tables", async () => {
      const mockTablesResponse = {
        tables: [
          {
            name: "bronze_data",
            catalog_name: "test_catalog",
            schema_name: schemaName,
            table_type: "MANAGED",
            comment: "Bronze data table",
            created_at: 1620000000000,
          },
          {
            name: "silver_data",
            catalog_name: "test_catalog",
            schema_name: schemaName,
            table_type: "MANAGED",
            comment: "Silver data table",
            created_at: 1620000000001,
          },
        ],
        next_page_token: null,
      };

      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock tables list API call
      nock(databricksHost)
        .get(/\/api\/2\.1\/unity-catalog\/tables/)
        .query(true)
        .reply(200, mockTablesResponse);

      // Execute list tables
      const result = await databricksService.listTables(experimentName, experimentId);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.tables).toEqual(mockTablesResponse.tables);
    });
  });
});
