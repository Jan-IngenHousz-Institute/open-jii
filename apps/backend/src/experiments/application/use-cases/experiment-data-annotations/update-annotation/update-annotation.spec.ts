import { experimentAnnotations, experimentDataOutbox } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import type { AnnotationRecord } from "../../../../core/models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "../../../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";
import { UpdateAnnotationUseCase } from "./update-annotation";

describe("UpdateAnnotation", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateAnnotationUseCase;

  const created = new Date("2026-09-01T08:00:00.000Z");

  /** An annotation already in Postgres, as an earlier write left it. */
  async function existing(
    experimentId: string,
    overrides: Partial<AnnotationRecord> = {},
  ): Promise<AnnotationRecord> {
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
    const repository = testApp.module.get(ExperimentAnnotationsRepository);
    assertSuccess(await repository.transaction((tx) => repository.insert(tx, [record])));
    return record;
  }

  function annotations() {
    return testApp.database.select().from(experimentAnnotations);
  }

  function outbox() {
    return testApp.database.select().from(experimentDataOutbox);
  }

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

  it("changes a comment's text and updated time, owes its copy and starts it", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await existing(experiment.id);
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(
      experiment.id,
      record.id,
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 1 });
    const [kept] = await annotations();
    expect(kept).toEqual({ ...record, contentText: "Leaf was dry", updatedAt: kept.updatedAt });
    expect(kept.updatedAt.getTime()).toBeGreaterThan(created.getTime());
    expect(await outbox()).toEqual([
      expect.objectContaining({
        recordType: "annotation",
        recordId: record.id,
        destination: "lakehouse",
      }),
    ]);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("changes a flag's type and clears its text when none is given", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await existing(experiment.id, {
      type: "flag",
      flagType: "outlier",
      contentText: "Too high",
    });

    assertSuccess(
      await useCase.execute(
        experiment.id,
        record.id,
        { content: { type: "flag", flagType: "needs_review" } },
        testUserId,
      ),
    );

    expect(await annotations()).toEqual([
      expect.objectContaining({ flagType: "needs_review", contentText: null }),
    ]);
  });

  it("leaves a comment alone, and owes no copy, when the update is a flag", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await existing(experiment.id);

    const result = await useCase.execute(
      experiment.id,
      record.id,
      { content: { type: "flag", flagType: "outlier" } },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 0 });
    expect(await annotations()).toEqual([record]);
    expect(await outbox()).toEqual([]);
  });

  it("affects no row, and owes no copy, when the annotation is not there", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    const result = await useCase.execute(
      experiment.id,
      "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 0 });
    expect(await outbox()).toEqual([]);
  });

  it("refuses a request without a user", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    const result = await useCase.execute(
      experiment.id,
      "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      { content: { type: "comment", text: "Leaf was dry" } },
      "",
    );

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("answers not found for an experiment that does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("fails when Postgres refuses the update", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "transaction").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the annotations query")),
    );

    const result = await useCase.execute(
      experiment.id,
      "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the annotations query");
  });

  it("keeps the old text when the copy it owes cannot be written", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await existing(experiment.id);
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
      new Error("outbox unavailable"),
    );

    const result = await useCase.execute(
      experiment.id,
      record.id,
      { content: { type: "comment", text: "Leaf was dry" } },
      testUserId,
    );

    assertFailure(result);
    expect(await annotations()).toEqual([record]);
    expect(await outbox()).toEqual([]);
  });
});
