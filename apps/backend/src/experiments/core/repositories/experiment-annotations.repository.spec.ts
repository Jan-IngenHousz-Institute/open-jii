import { faker } from "@faker-js/faker";

import { eq, experimentAnnotations, experiments, sql } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { AnnotationRecord } from "../models/experiment-data-annotation.model";
import { ExperimentAnnotationsRepository } from "./experiment-annotations.repository";

describe("ExperimentAnnotationsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentAnnotationsRepository;
  let experimentId: string;
  let userId: string;

  const created = new Date("2026-09-01T08:00:00.000Z");

  function record(overrides: Partial<AnnotationRecord> = {}): AnnotationRecord {
    return {
      id: faker.string.uuid(),
      experimentId,
      tableName: "raw_data",
      rowId: "1",
      type: "comment",
      contentText: "Leaf was wet",
      flagType: null,
      createdBy: userId,
      createdAt: created,
      updatedAt: created,
      ...overrides,
    };
  }

  function stored(): Promise<AnnotationRecord[]> {
    return testApp.database.select().from(experimentAnnotations);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentAnnotationsRepository);
    userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Drought trial", userId });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps an annotation with the id and times it was given", async () => {
    const comment = record();

    assertSuccess(await repository.insert([comment]));

    expect(await stored()).toEqual([comment]);
  });

  it("updates an annotation's text and flag and its updated time, and nothing else", async () => {
    const flag = record({ type: "flag", flagType: "outlier", contentText: null });
    const later = new Date("2026-09-02T08:00:00.000Z");
    await repository.insert([flag]);

    assertSuccess(
      await repository.update(
        experimentId,
        flag.id,
        "flag",
        { flagType: "needs_review", contentText: "Check" },
        later,
      ),
    );

    expect(await stored()).toEqual([
      { ...flag, flagType: "needs_review", contentText: "Check", updatedAt: later },
    ]);
  });

  it("leaves an annotation of the other type as it is", async () => {
    const comment = record();
    await repository.insert([comment]);

    assertSuccess(
      await repository.update(
        experimentId,
        comment.id,
        "flag",
        { flagType: "outlier", contentText: null },
        new Date("2026-09-02T08:00:00.000Z"),
      ),
    );

    expect(await stored()).toEqual([comment]);
  });

  it("deletes one annotation by its id, only in its experiment", async () => {
    const comment = record();
    await repository.insert([comment]);

    assertSuccess(await repository.delete(faker.string.uuid(), comment.id));
    expect(await stored()).toHaveLength(1);

    assertSuccess(await repository.delete(experimentId, comment.id));
    expect(await stored()).toEqual([]);
  });

  it("deletes the annotations of one type on the given rows of one table", async () => {
    const onRow1 = record({ rowId: "1" });
    const onRow2 = record({ rowId: "2" });
    const flagOnRow1 = record({ rowId: "1", type: "flag", flagType: "outlier" });
    const otherTable = record({ rowId: "1", tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c" });
    await repository.insert([onRow1, onRow2, flagOnRow1, otherTable]);

    assertSuccess(await repository.deleteFromRows(experimentId, "raw_data", ["1"], "comment"));

    expect((await stored()).map(({ id }) => id).sort()).toEqual(
      [onRow2.id, flagOnRow1.id, otherTable.id].sort(),
    );
  });

  it("keeps a flag's type, and only a type the API takes", async () => {
    const flag = record({ type: "flag", flagType: "needs_review", contentText: null });

    assertSuccess(await repository.insert([flag]));

    expect(await stored()).toEqual([flag]);
    await expect(
      testApp.database.execute(
        sql`INSERT INTO experiment_annotations (id, experiment_id, table_name, row_id, type, flag_type, created_by)
            VALUES (${faker.string.uuid()}, ${experimentId}, 'raw_data', '2', 'flag', 'bogus', ${userId})`,
      ),
    ).rejects.toThrow();
  });

  it("goes with its experiment", async () => {
    await repository.insert([record()]);

    await testApp.database.delete(experiments).where(eq(experiments.id, experimentId));

    expect(await stored()).toEqual([]);
  });

  it("inserts more annotations than one statement takes, all or none", async () => {
    const many = Array.from({ length: 2500 }, (_, index) => record({ rowId: String(index) }));

    assertSuccess(await repository.insert(many));
    assertFailure(await repository.insert([record({ rowId: "new" }), many[2499]]));

    expect(await stored()).toHaveLength(2500);
  });

  it("deletes annotations on more rows than one statement takes", async () => {
    const rowIds = Array.from({ length: 10_005 }, (_, index) => String(index));
    await repository.insert(rowIds.map((rowId) => record({ rowId })));

    assertSuccess(await repository.deleteFromRows(experimentId, "raw_data", rowIds, "comment"));

    expect(await stored()).toEqual([]);
  });

  it("reports a refused write by Postgres's code, without the annotation in it", async () => {
    const comment = record({ contentText: "Plot 12 was trampled" });
    await repository.insert([comment]);

    const result = await repository.insert([comment]);

    assertFailure(result);
    expect(result.error.message).toBe("Postgres refused the annotations query with SQLSTATE 23505");
  });

  it("reports a driver failure as no answer, not as an SQLSTATE", async () => {
    vi.spyOn(testApp.database, "transaction").mockRejectedValue(
      new Error("write failed", { cause: { code: "CONNECT_TIMEOUT" } }),
    );

    const result = await repository.insert([record()]);

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the annotations query");
  });
});
