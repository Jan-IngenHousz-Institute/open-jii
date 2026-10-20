/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";

import { eq, experimentUploads } from "@repo/database";

import {
  success,
  failure,
  AppError,
  assertSuccess,
  assertFailure,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ExperimentDataUploadsRepository } from "./experiment-data-uploads.repository";
import type { NewUpload } from "./experiment-data-uploads.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("ExperimentDataUploadsRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataUploadsRepository;
  let databricksPort: DatabricksPort;
  let userId: string;
  let experimentId: string;

  function newUpload(overrides: Partial<NewUpload> = {}): NewUpload {
    return {
      id: faker.string.uuid(),
      experimentId,
      uploadTableId: faker.string.uuid(),
      uploadTableName: "leaf_traits",
      targetKind: "new",
      uploadDirectory: "upload_20260101T000000_abcdef12",
      sourceKind: "csv",
      createdBy: userId,
      ...overrides,
    };
  }

  async function created(overrides: Partial<NewUpload> = {}) {
    const result = await repository.create(newUpload(overrides));
    assertSuccess(result);
    return result.value;
  }

  async function stored(uploadId: string) {
    const [row] = await testApp.database
      .select()
      .from(experimentUploads)
      .where(eq(experimentUploads.id, uploadId));
    return row;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataUploadsRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
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

  describe("validateTargetTable", () => {
    const existingUploadTableId = "11111111-1111-1111-1111-111111111111";

    it("mints a new uploadTableId for a 'new' target when no name collides", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value.uploadTableName).toBe("leaf_traits");
      expect(result.value.uploadTableId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(databricksPort.getExperimentTableMetadata).toHaveBeenCalledWith(experimentId, {
        includeSchemas: false,
      });
    });

    it("returns conflict for a 'new' target whose name already exists in this experiment", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "upload",
            displayName: "leaf_traits",
            rowCount: 10,
            latestRowAt: null,
            schemaRevision: null,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
    });

    it("returns conflict for a 'new' target that an upload in flight is already creating", async () => {
      await created({ uploadTableName: "leaf_traits" });
      const metadata = vi
        .spyOn(databricksPort, "getExperimentTableMetadata")
        .mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      assertFailure(result);
      expect(result.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
      expect(metadata).not.toHaveBeenCalled();
    });

    it("frees a new table's name once the upload creating it has failed", async () => {
      const first = await created({ uploadTableName: "leaf_traits" });
      await repository.fail(first.id, "no_files");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      assertSuccess(result);
      expect(result.value.uploadTableName).toBe("leaf_traits");
    });

    it("rejects a 'new' target whose name collides with a reserved system table", async () => {
      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "raw_data" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("BAD_REQUEST");
      expect(result.error.message).toContain("reserved");
    });

    it("resolves an 'existing' target's display name from experiment_table_metadata", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "upload",
            displayName: "leaf_traits",
            rowCount: 1000,
            latestRowAt: null,
            schemaRevision: null,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual({
        uploadTableId: existingUploadTableId,
        uploadTableName: "leaf_traits",
      });
    });

    it("returns not-found for an 'existing' target id that the metadata table doesn't know", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(success([]));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("rejects an 'existing' target id that points at a non-upload table", async () => {
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(
        success([
          {
            identifier: existingUploadTableId,
            tableType: "macro",
            displayName: null,
            rowCount: 5,
            latestRowAt: null,
            schemaRevision: null,
          },
        ]),
      );

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "existing", uploadTableId: existingUploadTableId },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("propagates metadata fetch failures", async () => {
      const error = AppError.internal("Databricks unavailable");
      vi.spyOn(databricksPort, "getExperimentTableMetadata").mockResolvedValue(failure(error));

      const result = await repository.validateTargetTable({
        experimentId,
        target: { kind: "new", name: "leaf_traits" },
      });

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error).toBe(error);
    });
  });

  describe("create", () => {
    it("records a receiving upload with no run yet", async () => {
      const input = newUpload();

      const result = await repository.create(input);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        id: input.id,
        experimentId,
        uploadTableId: input.uploadTableId,
        uploadTableName: "leaf_traits",
        targetKind: "new",
        uploadDirectory: input.uploadDirectory,
        sourceKind: "csv",
        status: "receiving",
        jobRunId: null,
        fileCount: null,
        createdBy: userId,
      });
    });

    it("refuses a second upload creating the same new table while the first is in flight", async () => {
      await created();

      const second = await repository.create(newUpload());

      assertFailure(second);
      expect(second.error.code).toBe("UPLOAD_TABLE_NAME_TAKEN");
      expect(await testApp.database.select().from(experimentUploads)).toHaveLength(1);
    });

    it("lets several uploads append to the same existing table at once", async () => {
      const uploadTableId = faker.string.uuid();

      await created({ targetKind: "existing", uploadTableId });
      const second = await repository.create(newUpload({ targetKind: "existing", uploadTableId }));

      assertSuccess(second);
    });

    it("lets another experiment create a table of the same name", async () => {
      await created();
      const { experiment: other } = await testApp.createExperiment({ name: "Other", userId });

      const result = await repository.create(newUpload({ experimentId: other.id }));

      assertSuccess(result);
    });
  });

  describe("markQueued", () => {
    it("queues a receiving upload with the number of files it received", async () => {
      const record = await created();

      const result = await repository.markQueued(record.id, 3);

      assertSuccess(result);
      expect(result.value).toMatchObject({ status: "queued", fileCount: 3 });
    });

    it("leaves an upload that is no longer receiving alone", async () => {
      const record = await created();
      await repository.fail(record.id, "transfer_interrupted");

      const result = await repository.markQueued(record.id, 3);

      assertSuccess(result);
      expect(result.value).toBeNull();
      expect(await stored(record.id)).toMatchObject({ status: "failed", fileCount: null });
    });
  });

  describe("markFileReceived", () => {
    const anHourAgo = () => new Date(Date.now() - 60 * 60_000);

    async function lastActive(uploadId: string, at: Date) {
      await testApp.database
        .update(experimentUploads)
        .set({ updatedAt: at })
        .where(eq(experimentUploads.id, uploadId));
    }

    it("moves a receiving upload's last activity to now", async () => {
      const record = await created();
      const before = anHourAgo();
      await lastActive(record.id, before);

      const result = await repository.markFileReceived(record.id);

      assertSuccess(result);
      expect((await stored(record.id)).updatedAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it("leaves an upload that is no longer receiving alone", async () => {
      const record = await created();
      await repository.markQueued(record.id, 1);
      const before = anHourAgo();
      await lastActive(record.id, before);

      const result = await repository.markFileReceived(record.id);

      assertSuccess(result);
      expect((await stored(record.id)).updatedAt).toEqual(before);
    });
  });

  describe("listForExperiment", () => {
    it("lists an experiment's uploads, newest first", async () => {
      const older = await created({ uploadTableName: "older" });
      await testApp.database
        .update(experimentUploads)
        .set({ createdAt: new Date(Date.now() - DAY_MS) })
        .where(eq(experimentUploads.id, older.id));
      const newer = await created({ uploadTableName: "newer" });
      const { experiment: other } = await testApp.createExperiment({ name: "Other", userId });
      await created({ experimentId: other.id });

      const result = await repository.listForExperiment(experimentId, {});

      assertSuccess(result);
      expect(result.value.map((record) => record.id)).toEqual([newer.id, older.id]);
    });

    it("lists one upload table's uploads by its id or its name", async () => {
      const uploadTableId = faker.string.uuid();
      const leafTraits = await created({ uploadTableName: "leaf_traits", uploadTableId });
      await created({ uploadTableName: "soil_moisture" });

      const byId = await repository.listForExperiment(experimentId, { uploadTableId });
      const byName = await repository.listForExperiment(experimentId, {
        uploadTableName: "leaf_traits",
      });

      assertSuccess(byId);
      assertSuccess(byName);
      expect(byId.value.map((record) => record.id)).toEqual([leafTraits.id]);
      expect(byName.value.map((record) => record.id)).toEqual([leafTraits.id]);
    });
  });

  describe("findById", () => {
    it("finds an upload only within its own experiment", async () => {
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
    it("moves an in-flight upload along but leaves a finished one alone", async () => {
      const running = await created({ uploadTableName: "running" });
      const finished = await created({ uploadTableName: "finished" });
      await repository.fail(finished.id, "no_rows");

      await repository.updateInFlightStatus(running.id, "running");
      await repository.updateInFlightStatus(finished.id, "running");

      expect((await stored(running.id)).status).toBe("running");
      expect((await stored(finished.id)).status).toBe("failed");
    });

    it("attaches the job run an upload started", async () => {
      const record = await created();

      await repository.attachRun(record.id, 4242);

      expect((await stored(record.id)).jobRunId).toBe(4242);
    });

    it("completes with the row count and the files the job rejected", async () => {
      const record = await created();

      const result = await repository.complete(record.id, {
        rowCount: 5_000_000_000,
        rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
      });

      assertSuccess(result);
      expect(result.value).toMatchObject({
        status: "completed",
        rowCount: 5_000_000_000,
        rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
        errorCode: null,
      });
      expect(result.value?.completedAt).toBeInstanceOf(Date);
    });

    it("lets only the first finisher claim an upload", async () => {
      const record = await created();

      const first = await repository.complete(record.id, { rowCount: 10, rejectedFiles: [] });
      const second = await repository.fail(record.id, "unknown");

      assertSuccess(first);
      assertSuccess(second);
      expect(first.value?.status).toBe("completed");
      expect(second.value).toBeNull();
    });

    it("records the reason a failed upload gives and the files it rejected", async () => {
      const record = await created();

      const result = await repository.fail(record.id, "no_rows", [
        { name: "empty.csv", reason: "no_rows" },
      ]);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        status: "failed",
        errorCode: "no_rows",
        rejectedFiles: [{ name: "empty.csv", reason: "no_rows" }],
      });
      expect(result.value?.completedAt).toBeInstanceOf(Date);
    });

    it("finds only uploads still in flight", async () => {
      const receiving = await created({ uploadTableName: "receiving" });
      const queued = await created({ uploadTableName: "queued" });
      await repository.markQueued(queued.id, 1);
      const done = await created({ uploadTableName: "done" });
      await repository.complete(done.id, { rowCount: 10, rejectedFiles: [] });

      const result = await repository.findInFlight();

      assertSuccess(result);
      expect(result.value.map((record) => record.id).sort()).toEqual(
        [receiving.id, queued.id].sort(),
      );
    });

    it("finds finished uploads nobody has been told about yet", async () => {
      const announced = await created({ uploadTableName: "announced" });
      await repository.complete(announced.id, { rowCount: 10, rejectedFiles: [] });
      await repository.markAnnounced(announced.id);
      const pending = await created({ uploadTableName: "pending" });
      await repository.fail(pending.id, "unknown");
      await created({ uploadTableName: "in_flight" });

      const result = await repository.findUnannounced(new Date(Date.now() - DAY_MS));

      assertSuccess(result);
      expect(result.value.map((record) => record.id)).toEqual([pending.id]);
    });
  });
});
