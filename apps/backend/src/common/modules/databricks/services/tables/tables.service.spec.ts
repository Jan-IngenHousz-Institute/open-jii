import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksTablesService } from "./tables.service";

// Constants for testing
const MOCK_ACCESS_TOKEN = "mock-token";
const MOCK_EXPIRES_IN = 3600;

describe("DatabricksTablesService", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;

  let tablesService: DatabricksTablesService;
  let authService: DatabricksAuthService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    tablesService = testApp.module.get(DatabricksTablesService);

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

  describe("listTables", () => {
    const schemaName = "exp_test_experiment_123";

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
        .get(DatabricksTablesService.TABLES_ENDPOINT)
        .query({
          catalog_name: "test_catalog",
          schema_name: schemaName,
          omit_columns: false,
        })
        .reply(200, mockTablesResponse);

      // Execute list tables
      const result = await tablesService.listTables(schemaName);

      // Assert result is success
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.tables).toEqual(mockTablesResponse.tables);
    });

    it("should handle errors when listing tables", async () => {
      // Mock token request
      nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
        access_token: MOCK_ACCESS_TOKEN,
        expires_in: MOCK_EXPIRES_IN,
        token_type: "Bearer",
      });

      // Mock tables list API call with error
      nock(databricksHost)
        .get(DatabricksTablesService.TABLES_ENDPOINT)
        .query(true)
        .reply(404, { message: "Schema not found" });

      // Execute list tables
      const result = await tablesService.listTables(schemaName);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list Databricks tables");
    });

    it("should handle token fetch failure when listing tables", async () => {
      // Mock token request with error
      nock(databricksHost)
        .post(DatabricksAuthService.TOKEN_ENDPOINT)
        .reply(401, { error_description: "Invalid client credentials" });

      // Execute list tables
      const result = await tablesService.listTables(schemaName);

      // Assert result is failure
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to list Databricks tables");
    });
  });
});
