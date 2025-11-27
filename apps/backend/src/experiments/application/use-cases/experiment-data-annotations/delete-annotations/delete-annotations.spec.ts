import nock from "nock";

import { DatabricksAuthService } from "../../../../../common/modules/databricks/services/auth/auth.service";
import { DatabricksPipelinesService } from "../../../../../common/modules/databricks/services/pipelines/pipelines.service";
import { DatabricksSqlService } from "../../../../../common/modules/databricks/services/sql/sql.service";
import { DatabricksTablesService } from "../../../../../common/modules/databricks/services/tables/tables.service";
import { assertFailure, assertSuccess } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import { DeleteAnnotationsUseCase } from "./delete-annotations";

describe("DeleteAnnotations", () => {
  const testApp = TestHarness.App;
  const databricksHost = `${process.env.DATABRICKS_HOST}`;
  let testUserId: string;
  let useCase: DeleteAnnotationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(DeleteAnnotationsUseCase);

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

  it("should delete an annotation", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock token request
    nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Generate clean schema name
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
    const MOCK_CATALOG_NAME = "test_catalog";

    // Match any body value to match the delete statement with random IDs
    nock(databricksHost)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: 2,
            columns: [
              { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
              { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
            ],
          },
          total_row_count: 1,
          truncated: false,
        },
        result: {
          data_array: [["1", "1"]],
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    // Mock list tables for silver refresh
    nock(databricksHost)
      .get(`${DatabricksTablesService.TABLES_ENDPOINT}`)
      .query({
        catalog_name: MOCK_CATALOG_NAME,
        schema_name: `exp_${cleanName}_${experiment.id}`,
      })
      .reply(200, {
        tables: [
          {
            name: "enriched_sample",
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: `exp_${cleanName}_${experiment.id}`,
            table_type: "MANAGED",
            properties: { quality: "silver" },
            created_at: Date.now(),
          },
        ],
      });

    // Mock list pipelines
    nock(databricksHost)
      .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}`)
      .query({ max_results: 100 })
      .reply(200, {
        statuses: [
          {
            pipeline_id: "mock-pipeline-id",
            name: `exp-${cleanName}-DLT-Pipeline-DEV`,
            state: "RUNNING",
            health: "HEALTHY",
          },
        ],
      });

    // Mock get pipeline details
    nock(databricksHost)
      .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/mock-pipeline-id`)
      .reply(200, {
        pipeline_id: "mock-pipeline-id",
        name: `exp-${cleanName}-DLT-Pipeline-DEV`,
      });

    // Mock start pipeline update
    nock(databricksHost)
      .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/mock-pipeline-id/updates`)
      .reply(200, {
        update_id: "mock-update-id",
      });

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    expect(result.value).toStrictEqual({ rowsAffected: 1 });
  });

  it("should delete multiple annotations", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Generate clean schema name
    const cleanName = experiment.name.toLowerCase().trim().replace(/ /g, "_");
    const MOCK_CATALOG_NAME = "test_catalog";

    // Mock token request
    nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Match any body value to match the delete statement with random IDs
    nock(databricksHost)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
      .reply(200, {
        statement_id: "mock-meta-data-id",
        status: { state: "SUCCEEDED" },
        manifest: {
          schema: {
            column_count: 2,
            columns: [
              { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
              { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
            ],
          },
          total_row_count: 1,
          truncated: false,
        },
        result: {
          data_array: [["3", "3"]],
          chunk_index: 0,
          row_count: 0,
          row_offset: 0,
        },
      });

    // Mock list tables request for silver refresh
    nock(databricksHost)
      .get(`${DatabricksTablesService.TABLES_ENDPOINT}/${MOCK_CATALOG_NAME}/${cleanName}`)
      .reply(200, {
        tables: [
          {
            catalog_name: MOCK_CATALOG_NAME,
            schema_name: cleanName,
            name: "test_table",
            table_type: "TABLE",
            data_source_format: "DELTA",
            columns: [],
            storage_location: `s3://bucket/${cleanName}/test_table`,
            comment: JSON.stringify({ quality: "silver" }),
          },
        ],
      });

    // Mock list pipelines request
    nock(databricksHost)
      .get(DatabricksPipelinesService.PIPELINES_ENDPOINT)
      .reply(200, {
        statuses: [
          {
            pipeline_id: "mock-pipeline-id",
            name: experiment.name,
            state: "IDLE",
          },
        ],
      });

    // Mock get pipeline request
    nock(databricksHost)
      .get(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/mock-pipeline-id`)
      .reply(200, {
        pipeline_id: "mock-pipeline-id",
        spec: {
          name: experiment.name,
          catalog: MOCK_CATALOG_NAME,
          target: cleanName,
        },
        state: "IDLE",
      });

    // Mock start pipeline update request
    nock(databricksHost)
      .post(`${DatabricksPipelinesService.PIPELINES_ENDPOINT}/mock-pipeline-id/updates`)
      .reply(200, {
        update_id: "mock-update-id",
      });

    const request: DeleteAnnotationsRequest = {
      tableName: "test_table",
      rowIds: ["row1", "row2", "row3"],
      type: "comment",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    expect(result.value).toStrictEqual({ rowsAffected: 3 });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(nonExistentId, request, testUserId);

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

    const request: DeleteAnnotationsRequest = {
      annotationId: "annotation-123",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle Databricks service errors appropriately when deleting data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock token request
    nock(databricksHost).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Match any body value to match the update statement with random IDs and timestamps
    nock(databricksHost)
      .post(`${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`)
      .reply(500, { error: "Databricks error" }); // Error response does not need manifest/result

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain(
      "Failed to delete annotation: Databricks SQL query execution",
    );
  });
});
