import type { UpdateAnnotationBody } from "@repo/api";

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

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(UpdateAnnotationUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update a comment annotation", async () => {
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
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated comment text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toStrictEqual({ rowsAffected: 1 });
  });

  it("should update a flag annotation", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-flag-update",
      status: "active",
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "flag",
        flagType: "outlier",
        text: "Updated flag text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle flag annotation with null text", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Flag Null",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "flag",
        flagType: "outlier",
        text: undefined,
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should return bad request error when user ID is missing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    // Act - pass empty string as userId
    const result = await useCase.execute(experiment.id, annotationId, updateData, "");

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    // Act
    const result = await useCase.execute(nonExistentId, annotationId, updateData, testUserId);

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

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should handle repository updateAnnotation failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Update Fail",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to return failure
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(
      failure({
        message: "Failed to update annotation in database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert - should fail with internal error
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to update annotation");
  });

  it("should allow updating annotations in public experiments", async () => {
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
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "test-annotation-id";
    const updateData: UpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    // Act - testUserId (not owner) should be able to update in public experiment
    const result = await useCase.execute(experiment.id, annotationId, updateData, testUserId);

    // Assert - should succeed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });
});
