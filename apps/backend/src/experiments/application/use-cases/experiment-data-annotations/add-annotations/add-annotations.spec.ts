import nock from "nock";

import type { AddAnnotationsBulkBody } from "@repo/api";

import { DatabricksAuthService } from "../../../../../common/modules/databricks/services/auth/auth.service";
import { DatabricksSqlService } from "../../../../../common/modules/databricks/services/sql/sql.service";
import { assertFailure, assertSuccess } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { AddAnnotationsUseCase } from "./add-annotations";

const DATABRICKS_HOST = "https://test-databricks.example.com";

describe("AddAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddAnnotationsUseCase;

  const MOCK_WAREHOUSE_ID = "test-warehouse-id";
  const MOCK_CATALOG_NAME = "test_catalog";
  const MOCK_WAIT_TIMEOUT = "50s";
  const MOCK_DISPOSITION = "INLINE";
  const MOCK_FORMAT = "JSON_ARRAY";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(AddAnnotationsUseCase);

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

  it("should an annotation to experiment data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for create table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS annotations (
        id STRING NOT NULL PRIMARY KEY,
        user_id STRING NOT NULL,
        table_name STRING NOT NULL,
        row_id INT NOT NULL,
        type STRING NOT NULL,
        content_text STRING,
        flag_type STRING,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
      USING DELTA
    `;
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: createTableQuery,
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: 0,
          },
          total_row_count: 0,
          truncated: false,
        },
        result: {
          data_array: [],
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    // Match any body value to match the insert statement with random IDs and timestamps
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: 2,
            columns: [
              { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
              { name: "num_inserted_rows", type_name: "LONG", type_text: "BIGINT" },
            ],
          },
          total_row_count: 1,
          truncated: false,
        },
        result: {
          data_array: [["2", "2"]],
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    expect(result.value).toStrictEqual({ rowsAffected: 2 });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(nonExistentId, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
  });

  it("should return forbidden error when user does not have access to private experiment", async () => {
    // Create experiment with another user
    const otherUserId = await testApp.createTestUser({
      email: "other@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      description: "Private experiment",
      status: "active",
      visibility: "private", // Important: set to private
      userId: otherUserId, // Created by another user
    });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle Databricks service errors appropriately when ensuring the annotations table exists", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for create table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS annotations (
        id STRING NOT NULL PRIMARY KEY,
        user_id STRING NOT NULL,
        table_name STRING NOT NULL,
        row_id INT NOT NULL,
        type STRING NOT NULL,
        content_text STRING,
        flag_type STRING,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
      USING DELTA
    `;
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: createTableQuery,
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(500, { error: "Databricks error" }); // Error response does not need manifest/result

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain(
      "Failed to create annotations table: Databricks SQL query execution",
    );
  });

  it("should handle Databricks service errors appropriately when inserting data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Generate clean schema name to match the implementation
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Mock SQL query for create table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS annotations (
        id STRING NOT NULL PRIMARY KEY,
        user_id STRING NOT NULL,
        table_name STRING NOT NULL,
        row_id INT NOT NULL,
        type STRING NOT NULL,
        content_text STRING,
        flag_type STRING,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
      USING DELTA
    `;
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`, {
        statement: createTableQuery,
        warehouse_id: MOCK_WAREHOUSE_ID,
        schema: `exp_${cleanName}_${experiment.id}`,
        catalog: MOCK_CATALOG_NAME,
        wait_timeout: MOCK_WAIT_TIMEOUT,
        disposition: MOCK_DISPOSITION,
        format: MOCK_FORMAT,
      })
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: 0,
          },
          total_row_count: 0,
          truncated: false,
        },
        result: {
          data_array: [],
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    // Match any body value to match the insert statement with random IDs and timestamps
    nock(DATABRICKS_HOST)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
      .reply(500, { error: "Databricks error" }); // Error response does not need manifest/result

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain(
      "Failed to insert annotations: Databricks SQL query execution",
    );
  });
});
