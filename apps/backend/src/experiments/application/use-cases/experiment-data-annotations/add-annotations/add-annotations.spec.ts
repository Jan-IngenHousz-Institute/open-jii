import type { AddAnnotationsBulkBody } from "@repo/api";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { UserRepository } from "../../../../../users/core/repositories/user.repository";
import { ExperimentDataAnnotationsRepository } from "../../../../core/repositories/experiment-data-annotations.repository";
import { AddAnnotationsUseCase } from "./add-annotations";

describe("AddAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddAnnotationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(AddAnnotationsUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add an annotation to experiment data", async () => {
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
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 2 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toStrictEqual({ rowsAffected: 2 });
  });

  it("should return bad request error when user ID is missing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "This is a test comment",
        },
      },
    };

    // Act - pass empty string as userId
    const result = await useCase.execute(experiment.id, newAnnotation, "");

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
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
      visibility: "private",
      userId: otherUserId,
    });

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
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

  it("should handle repository storeAnnotations failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Store Fail",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to return failure
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(
      failure({
        message: "Failed to store annotations in database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "test_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "Test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert - should fail with internal error
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to store annotations");
  });

  it("should add flag annotation to experiment data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-flag",
      status: "active",
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 2 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "experiment_data_table",
      rowIds: ["row1", "row2"],
      annotation: {
        type: "flag",
        content: {
          type: "flag",
          flagType: "outlier",
          text: "This data point is an outlier",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(2);
  });

  it("should handle annotation with empty comment text", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Empty Comment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "test_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert - should still succeed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle flag annotation with null text using nullish coalescing", async () => {
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
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "test_table",
      rowIds: ["row1"],
      annotation: {
        type: "flag",
        content: {
          type: "flag",
          flagType: "outlier",
          text: undefined,
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle user profile with empty firstName and lastName", async () => {
    // Create a test user with empty name fields
    const emptyNameUserId = await testApp.createTestUser({
      email: "emptyname@example.com",
    });

    // Update the user profile to have empty strings for names
    const userRepository = testApp.module.get(UserRepository);
    vi.spyOn(userRepository, "findUsersByIds").mockResolvedValue(
      success([
        {
          userId: emptyNameUserId,
          firstName: "   ",
          lastName: "   ",
          image: null,
        },
      ]),
    );

    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment Empty Name",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: emptyNameUserId,
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "test_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "Test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, emptyNameUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });

  it("should handle user profile fetch failure gracefully and still add annotations", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment User Profile Failure",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Mock the user repository to return failure
    const userRepository = testApp.module.get(UserRepository);
    vi.spyOn(userRepository, "findUsersByIds").mockResolvedValue(
      failure({
        message: "Database error fetching user profiles",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    // Mock the annotations repository to succeed
    const repository = testApp.module.get(ExperimentDataAnnotationsRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: AddAnnotationsBulkBody = {
      tableName: "test_table",
      rowIds: ["row1"],
      annotation: {
        type: "comment",
        content: {
          type: "comment",
          text: "Test comment",
        },
      },
    };

    // Act
    const result = await useCase.execute(experiment.id, newAnnotation, testUserId);

    // Assert - should still succeed even though user profile fetch failed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });
});
