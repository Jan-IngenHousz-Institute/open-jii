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

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(DeleteAnnotationsUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete a single annotation by ID", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const request: DeleteAnnotationsRequest = {
      annotationId: "c926b964-a1fd-4fb9-9a41-c154d631a524",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toStrictEqual({ rowsAffected: 1 });

    // Verify the repository was called correctly
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteAnnotation).toHaveBeenCalledWith(experiment.id, request.annotationId);
  });

  it("should delete multiple annotations in bulk", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment for Bulk Delete",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotationsBulk").mockResolvedValue(success({ rowsAffected: 3 }));

    const request: DeleteAnnotationsRequest = {
      tableName: "test_table",
      rowIds: ["row1", "row2", "row3"],
      type: "comment",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(3);

    // Verify the repository was called correctly
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteAnnotationsBulk).toHaveBeenCalledWith(
      experiment.id,
      request.tableName,
      request.rowIds,
      request.type,
    );
  });

  it("should return bad request error when user ID is missing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const request: DeleteAnnotationsRequest = {
      annotationId: "test-annotation-id",
    };

    // Act - pass empty string as userId
    const result = await useCase.execute(experiment.id, request, "");

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const request: DeleteAnnotationsRequest = {
      annotationId: "test-annotation-id",
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
      visibility: "private",
      userId: otherUserId,
    });

    const request: DeleteAnnotationsRequest = {
      annotationId: "test-annotation-id",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle repository deleteAnnotation failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Delete Fail",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to return failure
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotation").mockResolvedValue(
      failure({
        message: "Failed to delete annotation from database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const request: DeleteAnnotationsRequest = {
      annotationId: "test-annotation-id",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert - should fail with internal error
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to delete annotation");
  });

  it("should handle repository deleteAnnotationsBulk failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Bulk Delete Fail",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
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
      rowIds: ["row1"],
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

  it("should allow deleting annotations from public experiments", async () => {
    // Create a public experiment with another user
    const otherUserId = await testApp.createTestUser({
      email: "other@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Public Experiment",
      description: "Public experiment",
      status: "active",
      visibility: "public",
      userId: otherUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const request: DeleteAnnotationsRequest = {
      annotationId: "test-annotation-id",
    };

    // Act - testUserId (not owner) should be able to delete from public experiment
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert - should succeed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should delete flag annotations in bulk", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-flag-delete",
      status: "active",
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "deleteAnnotationsBulk").mockResolvedValue(success({ rowsAffected: 2 }));

    const request: DeleteAnnotationsRequest = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      type: "flag",
    };

    // Act
    const result = await useCase.execute(experiment.id, request, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(2);

    // Verify the repository was called with flag type
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteAnnotationsBulk).toHaveBeenCalledWith(
      experiment.id,
      request.tableName,
      request.rowIds,
      "flag",
    );
  });
});
