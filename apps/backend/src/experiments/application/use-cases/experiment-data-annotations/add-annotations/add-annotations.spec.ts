import type { ExperimentAddAnnotationsBulkBody } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { experimentAnnotations } from "@repo/database";

import {
  assertFailure,
  AppError,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { UserRepository } from "../../../../../users/core/repositories/user.repository";
import { ExperimentAnnotationsWarehouseRepository } from "../../../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 2 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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

    const result = await useCase.execute(nonExistentId, newAnnotation, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(
      failure({
        message: "Failed to store annotations in database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 2 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
          avatarUrl: null,
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "storeAnnotations").mockResolvedValue(success({ rowsAffected: 1 }));

    const newAnnotation: ExperimentAddAnnotationsBulkBody = {
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

  describe("the copy in Postgres", () => {
    const comment: ExperimentAddAnnotationsBulkBody = {
      tableName: "raw_data",
      rowIds: ["1", "2"],
      annotation: { type: "comment", content: { type: "comment", text: "Leaf was wet" } },
    };

    it("keeps each annotation with the id and time the lakehouse got", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const store = vi
        .spyOn(testApp.module.get(ExperimentAnnotationsWarehouseRepository), "storeAnnotations")
        .mockResolvedValue(success({ rowsAffected: 2 }));

      assertSuccess(await useCase.execute(experiment.id, comment, testUserId));

      const [, sent, now] = store.mock.calls[0];
      const copied = await testApp.database.select().from(experimentAnnotations);
      expect(copied.map(({ id }) => id).sort()).toEqual(sent.map(({ id }) => id).sort());
      expect(copied[0]).toMatchObject({
        experimentId: experiment.id,
        tableName: "raw_data",
        type: "comment",
        contentText: "Leaf was wet",
        createdBy: testUserId,
        createdAt: now,
        updatedAt: now,
      });
    });

    it("copies nothing when the lakehouse refuses the annotations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "storeAnnotations",
      ).mockResolvedValue(failure(AppError.internal("Warehouse down")));

      assertFailure(await useCase.execute(experiment.id, comment, testUserId));

      expect(await testApp.database.select().from(experimentAnnotations)).toEqual([]);
    });

    it("still adds the annotations when the copy fails", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "storeAnnotations",
      ).mockResolvedValue(success({ rowsAffected: 2 }));
      vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "insert").mockResolvedValue(
        failure(AppError.internal("Postgres down")),
      );

      const result = await useCase.execute(experiment.id, comment, testUserId);

      assertSuccess(result);
      expect(result.value.rowsAffected).toBe(2);
    });
  });
});
