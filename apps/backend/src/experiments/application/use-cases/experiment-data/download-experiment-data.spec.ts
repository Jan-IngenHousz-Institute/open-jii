import nock from "nock";
import { beforeEach, afterEach, beforeAll, afterAll, describe, it, expect, vi } from "vitest";

import { DatabricksAuthService } from "../../../../common/modules/databricks/services/auth/auth.service";
import { DatabricksSqlService } from "../../../../common/modules/databricks/services/sql/sql.service";
import { DatabricksTablesService } from "../../../../common/modules/databricks/services/tables/tables.service";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DownloadExperimentDataUseCase } from "./download-experiment-data";

const DATABRICKS_HOST = "https://test-databricks.example.com";

describe("DownloadExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DownloadExperimentDataUseCase;

  const MOCK_WAREHOUSE_ID = "test-warehouse-id";
  const MOCK_CATALOG_NAME = "test_catalog";
  const MOCK_WAIT_TIMEOUT = "50s";
  const MOCK_DISPOSITION = "EXTERNAL_LINKS";
  const MOCK_FORMAT = "CSV";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(DownloadExperimentDataUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    testApp.afterEach();
    nock.cleanAll();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully prepare download links for table data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Download_Test_Experiment",
      description: "Test Download Description",
      status: "active",
      visibility: "private",
      embargoUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userId: testUserId,
    });

    // Mock the external links data
    const mockExternalLinksData = {
      external_links: [
        {
          chunk_index: 0,
          row_count: 1000,
          row_offset: 0,
          byte_count: 50000,
          external_link: "https://databricks-presigned-url.com/chunk0",
          expiration: "2024-01-01T15:00:00.000Z",
        },
        {
          chunk_index: 1,
          row_count: 500,
          row_offset: 1000,
          byte_count: 25000,
          external_link: "https://databricks-presigned-url.com/chunk1",
          expiration: "2024-01-01T15:00:00.000Z",
        },
      ],
      totalRows: 1500,
      format: "CSV",
    };

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to validate table exists
    nock(DATABRICKS_HOST)
      .get(DatabricksTablesService.TABLES_ENDPOINT)
      .query(true)
      .reply(200, {
        tables: [
          {
            name: "bronze_data",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_download_test_experiment_${experiment.id}`,
          },
        ],
      });

    // Mock SQL query with EXTERNAL_LINKS disposition
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: "SELECT * FROM bronze_data",
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_download_test_experiment_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
        byte_limit: 100 * 1024 * 1024 * 1024, // 100 GiB
      })
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
          total_row_count: mockExternalLinksData.totalRows,
          format: mockExternalLinksData.format,
        },
        result: {
          external_links: mockExternalLinksData.external_links,
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const downloadData = result.value;

    expect(downloadData).toEqual({
      externalLinks: [
        {
          externalLink: "https://databricks-presigned-url.com/chunk0",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 50000,
          rowCount: 1000,
        },
        {
          externalLink: "https://databricks-presigned-url.com/chunk1",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 25000,
          rowCount: 500,
        },
      ],
    });
  });

  it("should return error when table does not exist", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment_NoTable",
      userId: testUserId,
    });

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock listTables API call to return empty tables
    nock(DATABRICKS_HOST).get(DatabricksTablesService.TABLES_ENDPOINT).query(true).reply(200, {
      tables: [],
    });

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "nonexistent_table",
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toContain("Table 'nonexistent_table' not found");
  });

  it("should return error when user doesn't have access to experiment", async () => {
    // Create another user
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    // Create an experiment with the first user
    const { experiment } = await testApp.createExperiment({
      name: "Private_Experiment",
      visibility: "private",
      userId: testUserId,
    });

    // Try to download with the second user (no access)
    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "some_table",
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Access denied to this experiment");
  });
});
