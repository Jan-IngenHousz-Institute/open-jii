import { experiments } from "@repo/database";

import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import {
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { DeleteAnnotationsUseCase } from "./delete-annotations";

describe("DeleteAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteAnnotationsUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(DeleteAnnotationsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
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
      pipelineId: "test-pipeline-123",
    });

    // Mock DatabricksAdapter methods
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
        ],
        rows: [["1", "1"]],
        totalRows: 1,
        truncated: false,
      }),
    );

    // Mock the refresh silver data call
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({ update_id: "mock-update-id" }),
    );

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
      name: "Test Experiment for Bulk Delete",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
      pipelineId: "test-pipeline-456",
    });

    // Mock DatabricksAdapter methods
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
        ],
        rows: [["3", "3"]],
        totalRows: 1,
        truncated: false,
      }),
    );

    // Mock the refresh silver data call
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({ update_id: "mock-update-id" }),
    );

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

    // Mock DatabricksAdapter to fail
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      failure({
        message: "Databricks SQL query execution failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "DatabricksError",
      }),
    );

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

  it("should continue operation when silver data refresh fails for single annotation deletion", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-delete-single",
      status: "active",
    });

    // Mock the repository methods
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    // Mock the silver data refresh (failure)
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    // Act
    const result = await useCase.execute(
      experiment.id,
      { annotationId: "test-annotation-id" },
      testUserId,
    );

    // Assert - operation should still succeed despite refresh failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle repository deleteAnnotationsBulk failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Bulk Delete Fail",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
      pipelineId: "test-pipeline-bulk-delete-fail",
    });

    // Mock the repository to return failure
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotationsBulk").mockResolvedValue(
      failure({
        message: "Failed to delete annotations from database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const request: DeleteAnnotationsRequest = {
      tableName: "test_table",
      rowIds: ["row1", "row2"],
      type: "comment",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert - should fail with internal error
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to delete annotations");
  });

  it("should continue operation when silver data refresh fails for bulk annotation deletion", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-delete-bulk",
      status: "active",
    });

    // Mock the repository methods
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotationsBulk").mockResolvedValue(success({ rowsAffected: 2 }));

    // Mock the silver data refresh (failure)
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const deleteRequest = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      type: "comment" as const,
    };

    // Act
    const result = await useCase.execute(experiment.id, deleteRequest, testUserId);

    // Assert - operation should still succeed despite refresh failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(2);
  });

  it("should handle missing user ID", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act - pass empty string as userId
    const result = await useCase.execute(experiment.id, request, "");

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should return error when experiment schema is not provisioned", async () => {
    // Create an experiment without schemaName by directly inserting into database
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({
        name: "Test Experiment No Schema",
        description: "Test Description",
        status: "provisioning",
        visibility: "public", // Public so no membership required
        createdBy: testUserId,
        schemaName: null, // No schema provisioned
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Experiment schema not provisioned");
  });

  it("should succeed even when pipelineId is null (no silver data refresh)", async () => {
    // Create an experiment without pipelineId
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({
        name: "Test Experiment No Pipeline",
        description: "Test Description",
        status: "active",
        visibility: "public", // Public so no membership required
        createdBy: testUserId,
        schemaName: "exp_test_no_pipeline_abc123",
        pipelineId: null, // No pipeline
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();

    // Mock the repository method
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotation").mockResolvedValue(
      success({ affectedRows: 1, deletedRows: 1 }),
    );

    // Spy on refreshSilverData to ensure it's NOT called
    const refreshSpy = vi.spyOn(databricksAdapter, "refreshSilverData");

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.affectedRows).toBeGreaterThan(0);

    // Verify refreshSilverData was NOT called since pipelineId is null

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("should succeed with bulk delete even when pipelineId is null (no silver data refresh)", async () => {
    // Create an experiment without pipelineId
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({
        name: "Test Experiment No Pipeline Bulk",
        description: "Test Description",
        status: "active",
        visibility: "public", // Public so no membership required
        createdBy: testUserId,
        schemaName: "exp_test_no_pipeline_bulk_def456",
        pipelineId: null, // No pipeline
        embargoUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .returning();

    // Mock the repository method
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotationsBulk").mockResolvedValue(
      success({ affectedRows: 2, deletedRows: 2 }),
    );

    // Spy on refreshSilverData to ensure it's NOT called
    const refreshSpy = vi.spyOn(databricksAdapter, "refreshSilverData");

    const request: DeleteAnnotationsRequest = {
      tableName: "measurements",
      rowIds: ["row1", "row2"],
      type: "row",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.affectedRows).toBe(2);

    // Verify refreshSilverData was NOT called since pipelineId is null

    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("should handle pipeline refresh failure gracefully on single delete (log warning but succeed)", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Refresh Fail Single",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
      pipelineId: "test-pipeline-refresh-fail-single",
    });

    // Mock DatabricksAdapter
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
        ],
        rows: [["1", "1"]],
        totalRows: 1,
        truncated: false,
      }),
    );

    // Mock refresh to fail
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline refresh failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "DatabricksError",
      }),
    );

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert - should still succeed even though refresh failed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle pipeline refresh failure gracefully on bulk delete (log warning but succeed)", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Refresh Fail Bulk",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
      pipelineId: "test-pipeline-refresh-fail-bulk",
    });

    // Mock DatabricksAdapter
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_deleted_rows", type_name: "LONG", type_text: "BIGINT" },
        ],
        rows: [["3", "3"]],
        totalRows: 1,
        truncated: false,
      }),
    );

    // Mock refresh to fail
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline refresh failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "DatabricksError",
      }),
    );

    const request: DeleteAnnotationsRequest = {
      tableName: "test_table",
      rowIds: ["row1", "row2", "row3"],
      type: "comment",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert - should still succeed even though refresh failed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(3);
  });
});
