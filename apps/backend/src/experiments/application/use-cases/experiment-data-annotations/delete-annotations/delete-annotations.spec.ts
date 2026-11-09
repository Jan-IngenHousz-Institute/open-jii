import { faker } from "@faker-js/faker";

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
import { ExperimentDataOutboxWorker } from "../../../services/experiment-data-outbox.worker";
import { DeleteAnnotationsUseCase } from "./delete-annotations";

describe("DeleteAnnotations", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteAnnotationsUseCase;

  const created = new Date("2026-09-01T08:00:00.000Z");

  async function existing(
    experimentId: string,
    ...overrides: Partial<AnnotationRecord>[]
  ): Promise<AnnotationRecord[]> {
    const records = overrides.map(
      (override): AnnotationRecord => ({
        id: faker.string.uuid(),
        experimentId,
        tableName: "raw_data",
        rowId: "1",
        type: "comment",
        contentText: "Leaf was wet",
        flagType: null,
        createdBy: testUserId,
        createdAt: created,
        updatedAt: created,
        ...override,
      }),
    );
    const repository = testApp.module.get(ExperimentAnnotationsRepository);
    assertSuccess(await repository.transaction((tx) => repository.insert(tx, records)));
    return records;
  }

  async function annotationIds(): Promise<string[]> {
    return (await testApp.database.select().from(experimentAnnotations)).map(({ id }) => id).sort();
  }

  async function owed(): Promise<string[]> {
    return (await testApp.database.select().from(experimentDataOutbox))
      .map(({ recordId }) => recordId)
      .sort();
  }

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

  it("deletes one annotation by its id, owes its copy's delete and starts it", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const [doomed, kept] = await existing(experiment.id, {}, { rowId: "2" });
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(experiment.id, { annotationId: doomed.id }, testUserId);

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 1 });
    expect(await annotationIds()).toEqual([kept.id]);
    expect(await owed()).toEqual([doomed.id]);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("deletes the annotations of one type on the given rows, owing each copy's delete", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const [onRow1, onRow2, flagOnRow1] = await existing(
      experiment.id,
      { rowId: "1" },
      { rowId: "2" },
      { rowId: "1", type: "flag", flagType: "outlier" },
    );

    const result = await useCase.execute(
      experiment.id,
      { tableName: "raw_data", rowIds: ["1", "2"], type: "comment" },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 2 });
    expect(await annotationIds()).toEqual([flagOnRow1.id]);
    expect(await owed()).toEqual([onRow1.id, onRow2.id].sort());
  });

  it("affects no row, and owes no copy, when there is nothing to delete", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    const result = await useCase.execute(
      experiment.id,
      { annotationId: faker.string.uuid() },
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toEqual({ rowsAffected: 0 });
    expect(await owed()).toEqual([]);
  });

  it("refuses a request without a user", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, { annotationId: faker.string.uuid() }, "");

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("answers not found for an experiment that does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      { annotationId: faker.string.uuid() },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("fails when Postgres refuses the delete", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(testApp.module.get(ExperimentAnnotationsRepository), "transaction").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the annotations query")),
    );

    const result = await useCase.execute(
      experiment.id,
      { annotationId: faker.string.uuid() },
      testUserId,
    );

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the annotations query");
  });
});
