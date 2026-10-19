import { faker } from "@faker-js/faker";

import { eq, experimentExports } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExportManifest } from "../models/experiment-data-exports.model";
import { ExperimentDataExportsRepository } from "./experiment-data-exports.repository";
import type { CarriedOverExport, NewExport } from "./experiment-data-exports.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

// When the job started, an hour ago, so the records it completes are well within retention.
const SNAPSHOT_AT = new Date(Date.now() - 60 * 60_000).toISOString();

describe("ExperimentDataExportsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataExportsRepository;
  let userId: string;
  let experimentId: string;

  function newExport(overrides: Partial<NewExport> = {}): NewExport {
    return {
      experimentId,
      tableName: "raw_data",
      format: "parquet",
      anonymizeContributors: false,
      createdBy: userId,
      ...overrides,
    };
  }

  function manifest(exportId: string, overrides: Partial<ExportManifest> = {}): ExportManifest {
    return {
      exportId,
      format: "parquet",
      rowCount: 1_500_000,
      snapshotAt: SNAPSHOT_AT,
      parts: [
        { name: "part-00000.snappy.parquet", sizeBytes: 3_000_000_000 },
        { name: "part-00001.snappy.parquet", sizeBytes: 1_000_000_000 },
      ],
      ...overrides,
    };
  }

  async function created(overrides: Partial<NewExport> = {}) {
    const result = await repository.createOrJoinInFlight(newExport(overrides));
    assertSuccess(result);
    return result.value.record;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataExportsRepository);
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

  describe("createOrJoinInFlight", () => {
    it("records a queued export with no run yet", async () => {
      const result = await repository.createOrJoinInFlight(newExport());

      assertSuccess(result);
      expect(result.value.created).toBe(true);
      expect(result.value.record).toMatchObject({
        experimentId,
        tableName: "raw_data",
        format: "parquet",
        status: "queued",
        jobRunId: null,
        createdBy: userId,
      });
    });

    it("joins the export already in flight for the same table, format and anonymisation", async () => {
      const first = await created();

      const second = await repository.createOrJoinInFlight(newExport());

      assertSuccess(second);
      expect(second.value.created).toBe(false);
      expect(second.value.record.id).toBe(first.id);
    });

    it("starts a separate export for another format or anonymisation", async () => {
      const first = await created();

      const otherFormat = await repository.createOrJoinInFlight(newExport({ format: "csv" }));
      const anonymised = await repository.createOrJoinInFlight(
        newExport({ anonymizeContributors: true }),
      );

      assertSuccess(otherFormat);
      assertSuccess(anonymised);
      expect(otherFormat.value.created).toBe(true);
      expect(anonymised.value.created).toBe(true);
      expect(
        new Set([first.id, otherFormat.value.record.id, anonymised.value.record.id]).size,
      ).toBe(3);
    });

    it("starts a new export once the previous one finished", async () => {
      const first = await created();
      await repository.fail(first.id, "unknown");

      const second = await repository.createOrJoinInFlight(newExport());

      assertSuccess(second);
      expect(second.value.created).toBe(true);
      expect(second.value.record.id).not.toBe(first.id);
    });
  });

  describe("listForTable", () => {
    it("lists one table's exports, newest first", async () => {
      const older = await created({ format: "csv" });
      await testApp.database
        .update(experimentExports)
        .set({ createdAt: new Date(Date.now() - DAY_MS) })
        .where(eq(experimentExports.id, older.id));
      const newer = await created({ format: "parquet" });
      await created({ tableName: "device" });

      const result = await repository.listForTable(experimentId, "raw_data");

      assertSuccess(result);
      expect(result.value.map((record) => record.id)).toEqual([newer.id, older.id]);
    });
  });

  describe("findById", () => {
    it("finds an export only within its own experiment", async () => {
      const record = await created();
      const { experiment: other } = await testApp.createExperiment({ name: "Other", userId });

      const own = await repository.findById(experimentId, record.id);
      const foreign = await repository.findById(other.id, record.id);

      assertSuccess(own);
      assertSuccess(foreign);
      expect(own.value?.id).toBe(record.id);
      expect(foreign.value).toBeNull();
    });
  });

  describe("status changes", () => {
    it("moves an in-flight export along but leaves a finished one alone", async () => {
      const running = await created();
      const finished = await created({ format: "csv" });
      await repository.fail(finished.id, "no_data");

      await repository.updateInFlightStatus(running.id, "running");
      await repository.updateInFlightStatus(finished.id, "running");

      const [runningRow] = await testApp.database
        .select()
        .from(experimentExports)
        .where(eq(experimentExports.id, running.id));
      const [finishedRow] = await testApp.database
        .select()
        .from(experimentExports)
        .where(eq(experimentExports.id, finished.id));
      expect(runningRow.status).toBe("running");
      expect(finishedRow.status).toBe("failed");
    });

    it("completes from the manifest with sizes beyond 32 bits, expiring 30 days after the run began", async () => {
      const record = await created();

      const result = await repository.complete(record.id, manifest(record.id));

      assertSuccess(result);
      expect(result.value).toMatchObject({
        status: "completed",
        rowCount: 1_500_000,
        totalBytes: 4_000_000_000,
        parts: manifest(record.id).parts,
        errorCode: null,
        expiresAt: new Date(Date.parse(SNAPSHOT_AT) + 30 * DAY_MS),
      });
      expect(result.value?.completedAt).toBeInstanceOf(Date);
    });

    it("lets only the first finisher claim an export", async () => {
      const record = await created();

      const first = await repository.complete(record.id, manifest(record.id));
      const second = await repository.fail(record.id, "unknown");

      assertSuccess(first);
      assertSuccess(second);
      expect(first.value?.status).toBe("completed");
      expect(second.value).toBeNull();
    });

    it("records the reason a failed export gives", async () => {
      const record = await created();

      const result = await repository.fail(record.id, "too_many_rows_for_format");

      assertSuccess(result);
      expect(result.value).toMatchObject({
        status: "failed",
        errorCode: "too_many_rows_for_format",
      });
    });

    it("finds only exports still in flight", async () => {
      const queued = await created();
      const done = await created({ format: "csv" });
      await repository.complete(done.id, manifest(done.id, { format: "csv" }));

      const result = await repository.findInFlight();

      assertSuccess(result);
      expect(result.value.map((record) => record.id)).toEqual([queued.id]);
    });

    it("expires completed exports past their retention", async () => {
      const due = await created();
      const fresh = await created({ format: "csv" });
      await repository.complete(due.id, manifest(due.id));
      await repository.complete(fresh.id, manifest(fresh.id, { format: "csv" }));
      await testApp.database
        .update(experimentExports)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(experimentExports.id, due.id));

      const result = await repository.expireDue(new Date());

      assertSuccess(result);
      expect(result.value).toBe(1);
      const rows = await testApp.database.select().from(experimentExports);
      expect(Object.fromEntries(rows.map((row) => [row.id, row.status]))).toEqual({
        [due.id]: "expired",
        [fresh.id]: "completed",
      });
    });
  });

  describe("insertCarriedOver", () => {
    function carried(overrides: Partial<CarriedOverExport> = {}): CarriedOverExport {
      const createdAt = new Date(Date.now() - 5 * DAY_MS);
      return {
        ...newExport(),
        id: faker.string.uuid(),
        jobRunId: 200436574855526,
        rowCount: 32_117_212,
        parts: [{ name: "part-00000.snappy.parquet", sizeBytes: 27_457_507_736 }],
        createdAt,
        completedAt: new Date(createdAt.getTime() + 20 * 60_000),
        ...overrides,
      };
    }

    it("records carried-over exports as completed, expiring 30 days after they were made", async () => {
      const record = carried();

      const result = await repository.insertCarriedOver([record]);

      assertSuccess(result);
      expect(result.value).toBe(1);
      const [row] = await testApp.database
        .select()
        .from(experimentExports)
        .where(eq(experimentExports.id, record.id));
      expect(row).toMatchObject({
        status: "completed",
        jobRunId: 200436574855526,
        totalBytes: 27_457_507_736,
        expiresAt: new Date(record.createdAt.getTime() + 30 * DAY_MS),
      });
    });

    it("replaces the failed record of a run that wrote its export the old way", async () => {
      const failedByDeploy = await created();
      await repository.attachRun(failedByDeploy.id, 200436574855526);
      await repository.fail(failedByDeploy.id, "unknown");
      const record = carried();

      const result = await repository.insertCarriedOver([record]);

      assertSuccess(result);
      expect(result.value).toBe(1);
      const rows = await testApp.database.select().from(experimentExports);
      expect(rows.map((row) => [row.id, row.status])).toEqual([[record.id, "completed"]]);
    });

    it("skips exports whose experiment or creator is gone, and records nothing twice", async () => {
      const kept = carried();
      const orphanedExperiment = carried({ experimentId: faker.string.uuid() });
      const orphanedCreator = carried({ createdBy: faker.string.uuid() });

      const first = await repository.insertCarriedOver([kept, orphanedExperiment, orphanedCreator]);
      const repeat = await repository.insertCarriedOver([kept]);

      assertSuccess(first);
      assertSuccess(repeat);
      expect(first.value).toBe(1);
      expect(repeat.value).toBe(0);
    });
  });
});
