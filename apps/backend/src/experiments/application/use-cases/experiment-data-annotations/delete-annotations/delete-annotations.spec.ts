import nock from "nock";

import { DatabricksAuthService } from "../../../../../common/modules/databricks/services/auth/auth.service";
import { DatabricksSqlService } from "../../../../../common/modules/databricks/services/sql/sql.service";
import { assertFailure, assertSuccess } from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import { DeleteAnnotationsUseCase } from "./delete-annotations";

const DATABRICKS_HOST = "https://test-databricks.example.com";

describe("DeleteAnnotations", () => {
  const testApp = TestHarness.App;
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Match any body value to match the delete statement with random IDs
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

    // Mock token request
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Match any body value to match the delete statement with random IDs
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
    nock(DATABRICKS_HOST).post(DatabricksAuthService.TOKEN_ENDPOINT).reply(200, {
      access_token: "mock-token",
      expires_in: 3600,
      token_type: "Bearer",
    });

    // Match any body value to match the update statement with random IDs and timestamps
    nock(DATABRICKS_HOST)
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
