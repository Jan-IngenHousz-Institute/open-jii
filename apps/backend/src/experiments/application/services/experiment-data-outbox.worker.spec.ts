import { faker } from "@faker-js/faker";

import { eq, experimentDataOutbox, profiles } from "@repo/database";

import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { AnnotationRecord } from "../../core/models/experiment-data-annotation.model";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataWarehouseRepository } from "../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import { ExperimentDataOutboxWorker } from "./experiment-data-outbox.worker";

describe("ExperimentDataOutboxWorker", () => {
  const testApp = TestHarness.App;
  let worker: ExperimentDataOutboxWorker;
  let experimentId: string;
  let userId: string;

  const created = new Date("2026-09-01T08:00:00.000Z");

  async function annotate(...rowIds: string[]): Promise<AnnotationRecord[]> {
    const records = rowIds.map(
      (rowId): AnnotationRecord => ({
        id: faker.string.uuid(),
        experimentId,
        tableName: "raw_data",
        rowId,
        type: "comment",
        contentText: "Leaf was wet",
        flagType: null,
        createdBy: userId,
        createdAt: created,
        updatedAt: created,
      }),
    );
    const repository = testApp.module.get(ExperimentAnnotationsRepository);
    const outbox = testApp.module.get(ExperimentDataOutboxRepository);
    assertSuccess(
      await repository.transaction(async (tx) => {
        await repository.insert(tx, records);
        await outbox.owe(
          tx,
          records.map((record) => ({
            recordType: "annotation",
            recordId: record.id,
            experimentId,
          })),
        );
      }),
    );
    return records;
  }

  /** Owes a copy of a record Postgres does not hold, as a delete leaves it. */
  async function oweGone(recordType: "annotation" | "metadata_sheet"): Promise<string> {
    const recordId = faker.string.uuid();
    await testApp.database.transaction((tx) =>
      testApp.module
        .get(ExperimentDataOutboxRepository)
        .owe(tx, [{ recordType, recordId, experimentId }]),
    );
    return recordId;
  }

  function outboxRows() {
    return testApp.database.select().from(experimentDataOutbox);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    worker = testApp.module.get(ExperimentDataOutboxWorker);
    userId = await testApp.createTestUser({});
    await testApp.database
      .update(profiles)
      .set({ firstName: "Ada", lastName: "Lovelace" })
      .where(eq(profiles.userId, userId));
    const { experiment } = await testApp.createExperiment({ name: "Drought trial", userId });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("copies the annotations Postgres holds with their author's name, deletes the copies of gone ones, and clears the rows", async () => {
    const warehouse = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
    const remove = vi.spyOn(warehouse, "delete").mockResolvedValue(success(undefined));
    const [kept] = await annotate("1");
    const gone = await oweGone("annotation");

    const counts = await worker.drain();

    expect(counts).toEqual({ applied: 2, retried: 0 });
    expect(merge).toHaveBeenCalledWith([{ ...kept, userName: "Ada Lovelace" }]);
    expect(remove).toHaveBeenCalledWith([gone]);
    expect(await outboxRows()).toEqual([]);
  });

  it("copies the sheets Postgres holds and deletes the copies of gone ones", async () => {
    const warehouse = testApp.module.get(ExperimentMetadataWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
    const remove = vi.spyOn(warehouse, "delete").mockResolvedValue(success(undefined));
    const sheet: MetadataSheetRecord = {
      id: faker.string.uuid(),
      experimentId,
      metadata: { name: "Plots" },
      createdBy: userId,
      createdAt: created,
      updatedAt: created,
    };
    const sheets = testApp.module.get(ExperimentMetadataRepository);
    const outbox = testApp.module.get(ExperimentDataOutboxRepository);
    assertSuccess(
      await sheets.transaction(async (tx) => {
        await sheets.insert(tx, sheet);
        await outbox.owe(tx, [{ recordType: "metadata_sheet", recordId: sheet.id, experimentId }]);
      }),
    );
    const gone = await oweGone("metadata_sheet");

    expect(await worker.drain()).toEqual({ applied: 2, retried: 0 });

    expect(merge).toHaveBeenCalledWith([sheet]);
    expect(remove).toHaveBeenCalledWith([gone]);
    expect(await outboxRows()).toEqual([]);
  });

  it("copies a batch of annotations in one statement", async () => {
    const warehouse = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
    vi.spyOn(warehouse, "delete").mockResolvedValue(success(undefined));
    await annotate(...Array.from({ length: 150 }, (_, index) => String(index)));

    expect(await worker.drain()).toEqual({ applied: 150, retried: 0 });

    expect(merge).toHaveBeenCalledTimes(1);
    expect(merge.mock.calls[0][0]).toHaveLength(150);
  });

  it("puts a copy the warehouse refused back to wait, with the reason, and leaves it until it is due", async () => {
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "merge",
    ).mockResolvedValue(failure(AppError.internal("Failed to merge annotations: Warehouse down")));
    await annotate("1");

    expect(await worker.drain()).toEqual({ applied: 0, retried: 1 });
    expect(await worker.drain()).toEqual({ applied: 0, retried: 0 });

    expect(await outboxRows()).toEqual([
      expect.objectContaining({
        attempts: 1,
        claimedAt: null,
        lastError: "Failed to merge annotations: Warehouse down",
      }),
    ]);
  });

  it("puts a copy back to wait when it outlasts its deadline", async () => {
    class HastyWorker extends ExperimentDataOutboxWorker {
      protected override readonly attemptDeadlineMs = 20;
    }
    const hasty = new HastyWorker(
      testApp.module.get(ExperimentDataOutboxRepository),
      testApp.module.get(ExperimentAnnotationsRepository),
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      testApp.module.get(ExperimentMetadataRepository),
      testApp.module.get(ExperimentMetadataWarehouseRepository),
    );
    vi.spyOn(testApp.module.get(ExperimentAnnotationsWarehouseRepository), "merge").mockReturnValue(
      new Promise(() => undefined),
    );
    await annotate("1");

    expect(await hasty.drain()).toEqual({ applied: 0, retried: 1 });

    expect(await outboxRows()).toEqual([
      expect.objectContaining({ attempts: 1, lastError: "Copy exceeded 0.02 s" }),
    ]);
  });

  it("does nothing when nothing is owed", async () => {
    const merge = vi.spyOn(testApp.module.get(ExperimentAnnotationsWarehouseRepository), "merge");

    expect(await worker.drain()).toEqual({ applied: 0, retried: 0 });

    expect(merge).not.toHaveBeenCalled();
  });
});
