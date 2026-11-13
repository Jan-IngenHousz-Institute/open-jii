import { faker } from "@faker-js/faker";
import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { createSecondaryDatabase, eq, experimentDataOutbox, profiles } from "@repo/database";

import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { AnnotationRecord } from "../../core/models/experiment-data-annotation.model";
import type { MetadataSheetRecord } from "../../core/models/experiment-metadata.model";
import { ExperimentAnnotationsWarehouseRepository } from "../../core/repositories/experiment-annotations-warehouse.repository";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataWarehouseRepository } from "../../core/repositories/experiment-metadata-warehouse.repository";
import { ExperimentMetadataRepository } from "../../core/repositories/experiment-metadata.repository";
import {
  EXPERIMENT_DATA_OUTBOX_INTERVAL,
  ExperimentDataOutboxWorker,
} from "./experiment-data-outbox.worker";

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

  /** A worker with its schedule and nudge live, as a task runs it; the harness hands out a quiet one. */
  function realWorker(
    outbox = testApp.module.get(ExperimentDataOutboxRepository),
  ): ExperimentDataOutboxWorker {
    return new ExperimentDataOutboxWorker(
      outbox,
      testApp.module.get(ExperimentAnnotationsRepository),
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      testApp.module.get(ExperimentMetadataRepository),
      testApp.module.get(ExperimentMetadataWarehouseRepository),
    );
  }

  function mergeAnnotations() {
    const warehouse = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    vi.spyOn(warehouse, "delete").mockResolvedValue(success(undefined));
    return vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
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

    expect(counts).toEqual({ applied: 2, retried: 0, released: 0 });
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

    expect(await worker.drain()).toEqual({ applied: 2, retried: 0, released: 0 });

    expect(merge).toHaveBeenCalledWith([sheet]);
    expect(remove).toHaveBeenCalledWith([gone]);
    expect(await outboxRows()).toEqual([]);
  });

  it("copies a batch of annotations in one statement", async () => {
    const warehouse = testApp.module.get(ExperimentAnnotationsWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
    vi.spyOn(warehouse, "delete").mockResolvedValue(success(undefined));
    await annotate(...Array.from({ length: 150 }, (_, index) => String(index)));

    expect(await worker.drain()).toEqual({ applied: 150, retried: 0, released: 0 });

    expect(merge).toHaveBeenCalledTimes(1);
    expect(merge.mock.calls[0][0]).toHaveLength(150);
  });

  it("puts a copy the warehouse refused back to wait, with the reason, and leaves it until it is due", async () => {
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "merge",
    ).mockResolvedValue(failure(AppError.internal("Failed to merge annotations: Warehouse down")));
    await annotate("1");

    expect(await worker.drain()).toEqual({ applied: 0, retried: 1, released: 0 });
    expect(await worker.drain()).toEqual({ applied: 0, retried: 0, released: 0 });

    expect(await outboxRows()).toEqual([
      expect.objectContaining({
        attempts: 1,
        claimedAt: null,
        lastError: "Failed to merge annotations: Warehouse down",
      }),
    ]);
  });

  /** A worker whose claims run out of time after `deadlineMs`. */
  function workerWithDeadline(deadlineMs: number): ExperimentDataOutboxWorker {
    class HastyWorker extends ExperimentDataOutboxWorker {
      protected override readonly attemptDeadlineMs = deadlineMs;
    }
    return new HastyWorker(
      testApp.module.get(ExperimentDataOutboxRepository),
      testApp.module.get(ExperimentAnnotationsRepository),
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      testApp.module.get(ExperimentMetadataRepository),
      testApp.module.get(ExperimentMetadataWarehouseRepository),
    );
  }

  /** Sheets of about `bytes` each, saved with the copies they owe. */
  async function saveSheets(count: number, bytes: number): Promise<MetadataSheetRecord[]> {
    const records = Array.from(
      { length: count },
      (_, index): MetadataSheetRecord => ({
        id: faker.string.uuid(),
        experimentId,
        metadata: { name: `Plots ${index}`, notes: "x".repeat(bytes) },
        createdBy: userId,
        createdAt: created,
        updatedAt: created,
      }),
    );
    const sheets = testApp.module.get(ExperimentMetadataRepository);
    const outbox = testApp.module.get(ExperimentDataOutboxRepository);
    assertSuccess(
      await sheets.transaction(async (tx) => {
        for (const record of records) {
          await sheets.insert(tx, record);
        }
        await outbox.owe(
          tx,
          records.map((record) => ({
            recordType: "metadata_sheet",
            recordId: record.id,
            experimentId,
          })),
        );
      }),
    );
    return records;
  }

  it("reads and sends large sheets a statement at a time, clearing each statement's rows as it lands", async () => {
    const warehouse = testApp.module.get(ExperimentMetadataWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockResolvedValue(success(undefined));
    const read = vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "findByIds");
    await saveSheets(3, 3 * 1024 * 1024);

    expect(await worker.drain()).toEqual({ applied: 3, retried: 0, released: 0 });

    expect(merge.mock.calls.map(([sheets]) => sheets.length)).toEqual([1, 1, 1]);
    expect(read.mock.calls.map(([ids]) => ids.length)).toEqual([1, 1, 1]);
    expect(await outboxRows()).toEqual([]);
  });

  it("starts no statement once a claim's deadline passed, putting the rest back for a fresh claim", async () => {
    const warehouse = testApp.module.get(ExperimentMetadataWarehouseRepository);
    const merge = vi.spyOn(warehouse, "merge").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return success(undefined);
    });
    const release = vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "release");
    const retry = vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "markRetry");
    const sheets = await saveSheets(3, 3 * 1024 * 1024);

    // Each claim copies one sheet, then runs out of time; the next claim takes the rest.
    expect(await workerWithDeadline(200).drain()).toEqual({ applied: 3, retried: 0, released: 3 });

    expect(release.mock.calls.map(([rows]) => rows.length)).toEqual([2, 1]);
    expect(retry).not.toHaveBeenCalled();
    const copied = merge.mock.calls.flatMap(([batch]) => batch.map(({ id }) => id));
    expect(copied.sort()).toEqual(sheets.map(({ id }) => id).sort());
    expect(await outboxRows()).toEqual([]);
  });

  it("waits for a slow statement rather than letting it run on after its rows go back", async () => {
    let finished = false;
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "merge",
    ).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      finished = true;
      return success(undefined);
    });
    await annotate("1");

    expect(await workerWithDeadline(200).drain()).toEqual({ applied: 1, retried: 0, released: 0 });

    expect(finished).toBe(true);
    expect(await outboxRows()).toEqual([]);
  });

  it("puts back the sheets a task shutting down had not started", async () => {
    const stopping = realWorker();
    vi.spyOn(testApp.module.get(ExperimentMetadataWarehouseRepository), "merge").mockImplementation(
      () => {
        void stopping.onApplicationShutdown();
        return Promise.resolve(success(undefined));
      },
    );
    await saveSheets(3, 3 * 1024 * 1024);

    expect(await stopping.drain()).toEqual({ applied: 1, retried: 0, released: 2 });

    expect(await outboxRows()).toHaveLength(2);
  });

  it("sends what is left back to wait when a later statement fails", async () => {
    const warehouse = testApp.module.get(ExperimentMetadataWarehouseRepository);
    vi.spyOn(warehouse, "merge")
      .mockResolvedValueOnce(success(undefined))
      .mockResolvedValue(
        failure(AppError.internal("Failed to merge metadata sheets: Warehouse down")),
      );
    await saveSheets(3, 3 * 1024 * 1024);

    expect(await worker.drain()).toEqual({ applied: 1, retried: 2, released: 0 });

    expect(await outboxRows()).toEqual([
      expect.objectContaining({ attempts: 1, claimedAt: null }),
      expect.objectContaining({ attempts: 1, claimedAt: null }),
    ]);
  });

  it("copies each of forty annotations exactly once across two tasks draining together", async () => {
    const merge = mergeAnnotations();
    const records = await annotate(...Array.from({ length: 40 }, (_, index) => String(index)));
    // A second instance on its own connection is what a second task is: `draining` is per
    // process, so only the claim keeps the two apart.
    const secondary = createSecondaryDatabase();

    try {
      const otherTask = realWorker(new ExperimentDataOutboxRepository(secondary.database));

      const [first, second] = await Promise.all([worker.drain(), otherTask.drain()]);

      expect(first.applied + second.applied).toBe(40);
      const copied = merge.mock.calls.flatMap(([batch]) => batch.map(({ id }) => id));
      expect(copied.sort()).toEqual(records.map(({ id }) => id).sort());
      expect(await outboxRows()).toEqual([]);
    } finally {
      await secondary.close();
    }
  });

  it("returns zeros from a second drain while the first is still running", async () => {
    const merge = mergeAnnotations();
    await annotate("1");
    const claim = vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "claimDue");
    const reentrant: { counts?: Awaited<ReturnType<ExperimentDataOutboxWorker["drain"]>> } = {};
    merge.mockImplementationOnce(async () => {
      reentrant.counts = await worker.drain();
      return success(undefined);
    });

    expect(await worker.drain()).toEqual({ applied: 1, retried: 0, released: 0 });

    expect(reentrant.counts).toEqual({ applied: 0, retried: 0, released: 0 });
    // One claim that found the row, one that found nothing, none from the second call.
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("drains on the interval and on a nudge", async () => {
    const real = realWorker();
    const drain = vi
      .spyOn(real, "drain")
      .mockResolvedValue({ applied: 0, retried: 0, released: 0 });

    await real.drainOnSchedule();
    expect(drain).toHaveBeenCalledTimes(1);

    real.nudge();
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it("looks once more when a nudge lands during the last claim", async () => {
    const claim = vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "claimDue");
    const real = realWorker();

    // Nothing is owed, so the first claim comes back empty; the nudge in that moment is a write
    // that committed just after it looked.
    const drained = real.drain();
    real.nudge();

    expect(await drained).toEqual({ applied: 0, retried: 0, released: 0 });
    expect(claim.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("stops the drain when the claim itself fails", async () => {
    const merge = mergeAnnotations();
    await annotate("1");
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "claimDue").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    expect(await worker.drain()).toEqual({ applied: 0, retried: 0, released: 0 });
    expect(merge).not.toHaveBeenCalled();
  });

  it("clears the flag when the claim throws, so the next drain still runs", async () => {
    mergeAnnotations();
    await annotate("1");
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "claimDue").mockRejectedValueOnce(
      new Error("connection terminated"),
    );

    expect(await worker.drain()).toEqual({ applied: 0, retried: 0, released: 0 });
    expect(await worker.drain()).toEqual({ applied: 1, retried: 0, released: 0 });
  });

  it("treats a thrown copy as that attempt failing, not as the drain failing", async () => {
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "merge",
    ).mockRejectedValue(new Error("socket hang up"));
    await annotate("1");

    expect(await worker.drain()).toEqual({ applied: 0, retried: 1, released: 0 });
    expect(await outboxRows()).toEqual([
      expect.objectContaining({ attempts: 1, lastError: "socket hang up" }),
    ]);
  });

  it("claims nothing new once the task is shutting down, and waits for the copy in flight", async () => {
    const merge = mergeAnnotations();
    const [first] = await annotate("1");
    const stopping = realWorker();
    const stopped: { promise?: Promise<void>; later?: AnnotationRecord[] } = {};
    // Shutdown arrives while the first copy is in flight, with a second record owed meanwhile.
    merge.mockImplementationOnce(async () => {
      stopped.promise = stopping.onApplicationShutdown();
      stopped.later = await annotate("2");
      return success(undefined);
    });

    expect(await stopping.drain()).toEqual({ applied: 1, retried: 0, released: 0 });
    await stopped.promise;

    expect(merge).toHaveBeenCalledTimes(1);
    expect(merge.mock.calls[0][0].map(({ id }) => id)).toEqual([first.id]);
    expect((await outboxRows()).map(({ recordId }) => recordId)).toEqual(
      stopped.later?.map(({ id }) => id),
    );
  });

  it("counts a copy whose rows could not be cleared, and leaves them to the lease", async () => {
    mergeAnnotations();
    await annotate("1");
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "markApplied").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    expect(await worker.drain()).toEqual({ applied: 1, retried: 0, released: 0 });
    const [row] = await outboxRows();
    expect(row.claimedAt).not.toBeNull();
  });

  it("says so when another task took copied rows back before they were cleared", async () => {
    mergeAnnotations();
    await annotate("1");
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "markApplied").mockResolvedValue(
      success(0),
    );
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await worker.drain();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Lost the claim on copied experiment data before clearing it; another task has those rows",
        rows: 1,
      }),
    );
  });

  it("logs a copy still failing at the last wait as an error, which error tracking reads", async () => {
    vi.spyOn(
      testApp.module.get(ExperimentAnnotationsWarehouseRepository),
      "merge",
    ).mockResolvedValue(failure(AppError.internal("Warehouse down")));
    await annotate("1");
    await testApp.database.update(experimentDataOutbox).set({ attempts: 4 });
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    expect(await worker.drain()).toEqual({ applied: 0, retried: 1, released: 0 });

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Could not copy experiment data to the lakehouse; will retry",
        attempts: 5,
      }),
    );
  });

  it("leaves no outbox interval on the schedule under the harness", async () => {
    const merge = mergeAnnotations();
    await annotate("1");

    // The whole app is booted here, so a registered interval would copy rows other specs queue.
    expect(testApp.module.get(SchedulerRegistry).getIntervals()).not.toContain(
      EXPERIMENT_DATA_OUTBOX_INTERVAL,
    );

    await worker.drainOnSchedule();
    worker.nudge();

    expect(merge).not.toHaveBeenCalled();
    expect(await outboxRows()).toHaveLength(1);
  });

  it("does nothing when nothing is owed", async () => {
    const merge = vi.spyOn(testApp.module.get(ExperimentAnnotationsWarehouseRepository), "merge");

    expect(await worker.drain()).toEqual({ applied: 0, retried: 0, released: 0 });

    expect(merge).not.toHaveBeenCalled();
  });
});
