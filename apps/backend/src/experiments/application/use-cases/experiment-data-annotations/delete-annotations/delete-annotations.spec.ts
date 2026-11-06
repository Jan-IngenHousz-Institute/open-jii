import { Logger } from "@nestjs/common";

import { experimentAnnotations } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  success,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { DeleteAnnotationsRequest } from "../../../../core/models/experiment-data-annotation.model";
import type { AnnotationRecord } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
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

    const result = await useCase.execute(nonExistentId, request, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
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
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
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

  it("should delete flag annotations in bulk", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      userId: testUserId,
      name: "test-experiment-flag-delete",
      status: "active",
    });

    // Mock the repository to succeed
    const repository = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
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
    it("loses an annotation deleted by its id", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "deleteAnnotation",
      ).mockResolvedValue(success({ rowsAffected: 1 }));

      assertSuccess(await useCase.execute(experiment.id, { annotationId: record.id }, testUserId));

      expect(await postgres()).toEqual([]);
    });

    it("loses the annotations of one type deleted from rows", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      await inPostgres(experiment.id);
      const flag = await inPostgres(experiment.id, {
        id: "7a2d3c4b-5e6f-4a70-9b8c-0d1e2f3a4b5c",
        type: "flag",
        flagType: "outlier",
      });
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "deleteAnnotationsBulk",
      ).mockResolvedValue(success({ rowsAffected: 1 }));

      assertSuccess(
        await useCase.execute(
          experiment.id,
          { tableName: "raw_data", rowIds: ["1"], type: "comment" },
          testUserId,
        ),
      );

      expect(await postgres()).toEqual([flag]);
    });

    it("keeps an annotation the lakehouse would not delete", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Drought trial",
        userId: testUserId,
      });
      const record = await inPostgres(experiment.id);
      vi.spyOn(
        testApp.module.get(ExperimentAnnotationsWarehouseRepository),
        "deleteAnnotation",
      ).mockResolvedValue(failure(AppError.internal("Warehouse down")));

      assertFailure(await useCase.execute(experiment.id, { annotationId: record.id }, testUserId));

      expect(await postgres()).toEqual([record]);
    });
  });

  it("still deletes the annotations when the copy in Postgres fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "deleteAnnotationsBulk",
    ).mockResolvedValue(success({ rowsAffected: 2 }));
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsRepository),
      "deleteFromRows",
    ).mockResolvedValue(failure(AppError.internal("Postgres down")));
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    const result = await useCase.execute(
      experiment.id,
      { tableName: "raw_data", rowIds: ["1", "2"], type: "comment" },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value.rowsAffected).toBe(2);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Annotation delete not copied to Postgres",
        experimentId: experiment.id,
        tableName: "raw_data",
        rowCount: 2,
      }),
    );
  });

  it("names the annotation whose delete did not reach Postgres", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const annotationId = "5b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "deleteAnnotation",
    ).mockResolvedValue(success({ rowsAffected: 1 }));
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "delete").mockResolvedValue(
      failure(AppError.internal("Postgres down")),
    );
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    assertSuccess(await useCase.execute(experiment.id, { annotationId }, testUserId));

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Annotation delete not copied to Postgres",
        experimentId: experiment.id,
        annotationId,
      }),
    );
  });
});
