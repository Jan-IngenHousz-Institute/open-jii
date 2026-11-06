import type { ExperimentUpdateAnnotationBody } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";
import { experimentAnnotations } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { AnnotationRecord } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "c926b964-a1fd-4fb9-9a41-c154d631a524";
    const updateData: ExperimentUpdateAnnotationBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "test-annotation-id";
    const updateData: ExperimentUpdateAnnotationBody = {
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(success({ rowsAffected: 1 }));

    const annotationId = "test-annotation-id";
    const updateData: ExperimentUpdateAnnotationBody = {
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
    const updateData: ExperimentUpdateAnnotationBody = {
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
    const updateData: ExperimentUpdateAnnotationBody = {
      content: {
        type: "comment",
        text: "Updated text",
      },
    };

    const result = await useCase.execute(nonExistentId, annotationId, updateData, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(repository, "updateAnnotation").mockResolvedValue(
      failure({
        message: "Failed to update annotation in database",
        code: "DATABASE_ERROR",
        statusCode: 500,
        name: "DatabaseError",
      }),
    );

    const annotationId = "test-annotation-id";
    const updateData: ExperimentUpdateAnnotationBody = {
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

  /** An annotation already in Postgres, as an earlier write left it. */
  async function inPostgres(
    experimentId: string,
    overrides: Partial<AnnotationRecord> = {},
  ): Promise<AnnotationRecord> {
    const created = new Date("2026-09-01T08:00:00.000Z");
    const record: AnnotationRecord = {
      id: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      experimentId,
      tableName: "raw_data",
      rowId: "1",
      type: "comment",
      contentText: "Leaf was wet",
      flagType: null,
      createdBy: testUserId,
      createdAt: created,
      updatedAt: created,
      ...overrides,
    };
    assertSuccess(await testApp.module.get(ExperimentAnnotationsRepository).insert([record]));
    return record;
  }

  function postgres(): Promise<AnnotationRecord[]> {
    return testApp.database.select().from(experimentAnnotations);
  }

  describe("the copy in Postgres", () => {
    it("takes the update with the time the lakehouse got", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      const update = vi
        .spyOn(testApp.module.get(ExperimentAnnotationsWarehouseRepository), "updateAnnotation")
        .mockResolvedValue(success({ rowsAffected: 1 }));

      assertSuccess(
        await useCase.execute(
          experiment.id,
          record.id,
          { content: { type: "comment", text: "Leaf was dry" } },
          testUserId,
        ),
      );

      const [, , , now] = update.mock.calls[0];
      expect(await postgres()).toEqual([
        { ...record, contentText: "Leaf was dry", updatedAt: now },
      ]);
    });

    it("keeps the old text when the lakehouse refuses the update", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "updateAnnotation",
      ).mockResolvedValue(failure(AppError.internal("Warehouse down")));

      assertFailure(
        await useCase.execute(
          experiment.id,
          record.id,
          { content: { type: "comment", text: "Leaf was dry" } },
          testUserId,
        ),
      );

      expect(await postgres()).toEqual([record]);
    });
  });

  it("still updates the annotation when the copy in Postgres fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "updateAnnotation",
    ).mockResolvedValue(success({ rowsAffected: 1 }));
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "update").mockResolvedValue(
      failure(AppError.internal("Postgres down")),
    );

    const result = await useCase.execute(
      experiment.id,
      "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(1);
  });
});
