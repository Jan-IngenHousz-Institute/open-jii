import { faker } from "@faker-js/faker";

import { eq, experimentAnnotations, experiments, profiles, sql } from "@repo/database";

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

  async function insert(...records: AnnotationRecord[]): Promise<void> {
    assertSuccess(await repository.transaction((tx) => repository.insert(tx, records)));
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

    await insert(comment);

    expect(await stored()).toEqual([comment]);
  });

  it("updates an annotation's text and flag and its updated time, and nothing else", async () => {
    const flag = record({ type: "flag", flagType: "outlier", contentText: null });
    const later = new Date("2026-09-02T08:00:00.000Z");
    await insert(flag);

    const found = await repository.transaction((tx) =>
      repository.update(
        tx,
        experimentId,
        flag.id,
        "flag",
        { flagType: "needs_review", contentText: "Check" },
        later,
      ),
    );

    assertSuccess(found);
    expect(found.value).toBe(true);
    expect(await stored()).toEqual([
      { ...flag, flagType: "needs_review", contentText: "Check", updatedAt: later },
    ]);
  });

  it("leaves an annotation of the other type as it is, and says it found none", async () => {
    const comment = record();
    await insert(comment);

    const found = await repository.transaction((tx) =>
      repository.update(
        tx,
        experimentId,
        comment.id,
        "flag",
        { flagType: "outlier", contentText: null },
        new Date("2026-09-02T08:00:00.000Z"),
      ),
    );

    assertSuccess(found);
    expect(found.value).toBe(false);
    expect(await stored()).toEqual([comment]);
  });

  it("says when there was no annotation to update", async () => {
    const found = await repository.transaction((tx) =>
      repository.update(
        tx,
        experimentId,
        faker.string.uuid(),
        "comment",
        { contentText: "Check" },
        created,
      ),
    );

    assertSuccess(found);
    expect(found.value).toBe(false);
  });

  it("deletes one annotation by its id, only in its experiment, and says which", async () => {
    const comment = record();
    await insert(comment);

    const elsewhere = await repository.transaction((tx) =>
      repository.delete(tx, faker.string.uuid(), comment.id),
    );
    assertSuccess(elsewhere);
    expect(elsewhere.value).toEqual([]);
    expect(await stored()).toHaveLength(1);

    const deleted = await repository.transaction((tx) =>
      repository.delete(tx, experimentId, comment.id),
    );
    assertSuccess(deleted);
    expect(deleted.value).toEqual([comment.id]);
    expect(await stored()).toEqual([]);
  });

  it("deletes the annotations of one type on the given rows of one table, and says which", async () => {
    const onRow1 = record({ rowId: "1" });
    const onRow2 = record({ rowId: "2" });
    const flagOnRow1 = record({ rowId: "1", type: "flag", flagType: "outlier" });
    const otherTable = record({ rowId: "1", tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c" });
    await insert(onRow1, onRow2, flagOnRow1, otherTable);

    const deleted = await repository.transaction((tx) =>
      repository.deleteFromRows(tx, experimentId, "raw_data", ["1"], "comment"),
    );

    assertSuccess(deleted);
    expect(deleted.value).toEqual([onRow1.id]);
    expect((await stored()).map(({ id }) => id).sort()).toEqual(
      [onRow2.id, flagOnRow1.id, otherTable.id].sort(),
    );
  });

  it("keeps a flag's type, and only a type the API takes", async () => {
    const flag = record({ type: "flag", flagType: "needs_review", contentText: null });

    await insert(flag);

    expect(await stored()).toEqual([flag]);
    await expect(
      testApp.database.execute(
        sql`INSERT INTO experiment_annotations (id, experiment_id, table_name, row_id, type, flag_type, created_by)
            VALUES (${faker.string.uuid()}, ${experimentId}, 'raw_data', '2', 'flag', 'bogus', ${userId})`,
      ),
    ).rejects.toThrow();
  });

  it("goes with its experiment", async () => {
    await insert(record());

    await testApp.database.delete(experiments).where(eq(experiments.id, experimentId));

    expect(await stored()).toEqual([]);
  });

  it("inserts more annotations than one statement takes, all or none", async () => {
    const many = Array.from({ length: 2500 }, (_, index) => record({ rowId: String(index) }));

    await insert(...many);
    assertFailure(
      await repository.transaction((tx) =>
        repository.insert(tx, [record({ rowId: "new" }), many[2499]]),
      ),
    );

    expect(await stored()).toHaveLength(2500);
  });

  it("deletes annotations on more rows than one statement takes", async () => {
    const rowIds = Array.from({ length: 10_005 }, (_, index) => String(index));
    await insert(...rowIds.map((rowId) => record({ rowId })));

    const deleted = await repository.transaction((tx) =>
      repository.deleteFromRows(tx, experimentId, "raw_data", rowIds, "comment"),
    );

    assertSuccess(deleted);
    expect(deleted.value).toHaveLength(10_005);
    expect(await stored()).toEqual([]);
  });

  it("finds the annotations that still exist, each with its author's name as it reads now", async () => {
    const kept = record();
    await insert(kept);
    await testApp.database
      .update(profiles)
      .set({ firstName: "Ada", lastName: "Lovelace" })
      .where(eq(profiles.userId, userId));

    const found = await repository.findCopies([kept.id, faker.string.uuid()]);

    assertSuccess(found);
    expect(found.value).toEqual([{ ...kept, userName: "Ada Lovelace" }]);
  });

  it("names an author who deactivated their profile as every other read does", async () => {
    const kept = record();
    await insert(kept);
    await testApp.database
      .update(profiles)
      .set({ firstName: "Ada", lastName: "Lovelace", activated: false })
      .where(eq(profiles.userId, userId));

    const found = await repository.findCopies([kept.id]);

    assertSuccess(found);
    expect(found.value).toEqual([{ ...kept, userName: "Unknown User" }]);
  });

  it("finds no name for an author without a profile", async () => {
    const orphan = record({ createdBy: faker.string.uuid() });
    await insert(orphan);

    const found = await repository.findCopies([orphan.id]);

    assertSuccess(found);
    expect(found.value).toEqual([{ ...orphan, userName: null }]);
  });

  it("finds the annotations on given rows of one table, oldest first, with their authors' names", async () => {
    const later = record({ rowId: "1", createdAt: new Date("2026-09-03T08:00:00.000Z") });
    const earlier = record({ rowId: "2", createdAt: new Date("2026-09-02T08:00:00.000Z") });
    const otherRow = record({ rowId: "3" });
    const otherTable = record({ rowId: "1", tableName: "4f0c6b1e-3a8e-4b7e-9c55-1d2e3f4a5b6c" });
    await insert(later, earlier, otherRow, otherTable);
    await testApp.database
      .update(profiles)
      .set({ firstName: "Ada", lastName: "Lovelace" })
      .where(eq(profiles.userId, userId));

    const found = await repository.findOnRows(experimentId, "raw_data", ["1", "2"]);

    assertSuccess(found);
    expect(found.value.map(({ id, userName }) => [id, userName])).toEqual([
      [earlier.id, "Ada Lovelace"],
      [later.id, "Ada Lovelace"],
    ]);
  });

  it("finds annotations on more rows than one statement takes", async () => {
    const rowIds = Array.from({ length: 10_005 }, (_, index) => String(index));
    await insert(record({ rowId: "10004" }));

    const found = await repository.findOnRows(experimentId, "raw_data", rowIds);

    assertSuccess(found);
    expect(found.value.map(({ rowId }) => rowId)).toEqual(["10004"]);
  });

  it("reports a refused write by Postgres's code, without the annotation in it", async () => {
    const comment = record({ contentText: "Plot 12 was trampled" });
    await insert(comment);

    const result = await repository.transaction((tx) => repository.insert(tx, [comment]));

    assertFailure(result);
    expect(result.error.message).toBe("Postgres refused the annotations query with SQLSTATE 23505");
  });

  it("reports a driver failure as no answer, not as an SQLSTATE", async () => {
    vi.spyOn(testApp.database, "transaction").mockRejectedValue(
      new Error("write failed", { cause: { code: "CONNECT_TIMEOUT" } }),
    );

    const result = await repository.transaction((tx) => repository.insert(tx, [record()]));

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the annotations query");
  });
});
