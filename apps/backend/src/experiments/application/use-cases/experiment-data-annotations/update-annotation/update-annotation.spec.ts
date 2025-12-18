import type { UpdateAnnotationBody } from "@repo/api";

import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import {
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { UpdateAnnotationUseCase } from "./update-annotation";

describe("UpdateAnnotation", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateAnnotationUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(UpdateAnnotationUseCase);
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

  it("should update an annotation", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock DatabricksAdapter methods
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      success({
        columns: [
          { name: "num_affected_rows", type_name: "LONG", type_text: "BIGINT" },
          { name: "num_updated_rows", type_name: "LONG", type_text: "BIGINT" },
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

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "This is an updated comment",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateAnnotation, testUserId);

    // Assert result is success
    if (result.isFailure()) {
      console.log("Test failed with error:", result.error);
    }
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    expect(result.value).toStrictEqual({ rowsAffected: 1 });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "This is a new comment",
      },
    };

    // Act
    const result = await useCase.execute(nonExistentId, annotationId, updateAnnotation, testUserId);

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

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "This is a new comment",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle Databricks service errors appropriately when updating data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock Databricks adapter error
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValue(
      failure({
        message: "Failed to update annotation: INTERNAL_ERROR",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "This is a new comment",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateAnnotation, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to update annotation: INTERNAL_ERROR");
  });

  it("should handle missing user ID", async () => {
    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "This is a new comment",
      },
    };

    // Act
    const result = await useCase.execute("experiment-id", annotationId, updateAnnotation, "");

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should update flag annotation content", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-update-flag",
      status: "active",
    });

    // Mock the repository methods
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    // Mock the silver data refresh (success)
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      success({ update_id: "mock-update-id" }),
    );

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "flag",
        flagType: "needs_review",
        text: "Updated flag annotation text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateAnnotation, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should continue operation when silver data refresh fails", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-refresh-fail-update",
      status: "active",
    });

    // Mock the repository methods
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    // Mock the silver data refresh (failure)
    vi.spyOn(databricksAdapter, "refreshSilverData").mockResolvedValue(
      failure({
        message: "Pipeline update failed",
        code: "DATABRICKS_ERROR",
        statusCode: 500,
        name: "",
      }),
    );

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateAnnotation: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated comment text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateAnnotation, testUserId);

    // Assert - operation should still succeed despite refresh failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });
});
