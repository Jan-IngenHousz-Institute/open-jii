import { faker } from "@faker-js/faker";
import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

import { eq, experimentUploads, notifications } from "@repo/database";

import type {
  DatabricksJobRunOutputResponse,
  DatabricksJobRunStatusResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import {
  JobLifecycleState,
  JobResultState,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { TestHarness } from "../../../test/test-harness";
import { uploadOutcomeSchema } from "../../core/models/experiment-data-uploads.model";
import type { UploadOutcome } from "../../core/models/experiment-data-uploads.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { ExperimentDataUploadsRepository } from "../../core/repositories/experiment-data-uploads.repository";
import type { NewUpload } from "../../core/repositories/experiment-data-uploads.repository";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { UploadRunReconcilerService } from "./upload-run-reconciler.service";

const RUN_ID = 4242;

const TASK_RUN_ID = 11;

function run(
  lifeCycleState: JobLifecycleState,
  resultState?: JobResultState,
  tasks: DatabricksJobRunStatusResponse["tasks"] = [
    { run_id: TASK_RUN_ID, task_key: "process_upload", state: { life_cycle_state: "TERMINATED" } },
  ],
): DatabricksJobRunStatusResponse {
  return {
    run_id: RUN_ID,
    state: { life_cycle_state: lifeCycleState, state_message: "", result_state: resultState },
    tasks,
  };
}

const succeededRun = () => run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS);

// Written by the upload job's own tests, so both sides read one set of exit values.
const OUTCOME_FIXTURES = resolve(
  __dirname,
  "../../../../../data/tests/fixtures/upload_outcomes.json",
);

const zOutcomeFixtures = z.array(z.object({ case: z.string(), outcome: z.unknown() }));

describe("UploadRunReconcilerService", () => {
  const testApp = TestHarness.App;
  let reconciler: UploadRunReconcilerService;
  let uploadsRepository: ExperimentDataUploadsRepository;
  let databricksPort: DatabricksPort;
  let userId: string;
  let experimentId: string;

  async function uploadReceiving(overrides: Partial<NewUpload> = {}) {
    const recorded = await uploadsRepository.create({
      id: faker.string.uuid(),
      experimentId,
      uploadTableId: faker.string.uuid(),
      uploadTableName: "leaf_traits",
      targetKind: "existing",
      uploadDirectory: "upload_20260101T000000_abcdef12",
      sourceKind: "csv",
      createdBy: userId,
      ...overrides,
    });
    assertSuccess(recorded);
    return recorded.value;
  }

  async function uploadInFlight(
    jobRunId: number | null = RUN_ID,
    overrides: Partial<NewUpload> = {},
  ) {
    const record = await uploadReceiving(overrides);
    await uploadsRepository.markQueued(record.id, 2);
    if (jobRunId !== null) {
      await uploadsRepository.attachRun(record.id, jobRunId);
    }
    return record.id;
  }

  async function stored(uploadId: string) {
    const [row] = await testApp.database
      .select()
      .from(experimentUploads)
      .where(eq(experimentUploads.id, uploadId));
    return row;
  }

  async function backdate(uploadId: string, minutes: number) {
    await testApp.database
      .update(experimentUploads)
      .set({ createdAt: new Date(Date.now() - minutes * 60_000) })
      .where(eq(experimentUploads.id, uploadId));
  }

  async function stallTransfer(uploadId: string, minutes: number) {
    await testApp.database
      .update(experimentUploads)
      .set({ updatedAt: new Date(Date.now() - minutes * 60_000) })
      .where(eq(experimentUploads.id, uploadId));
  }

  async function finishedAgo(uploadId: string, hours: number) {
    await testApp.database
      .update(experimentUploads)
      .set({ completedAt: new Date(Date.now() - hours * 60 * 60_000) })
      .where(eq(experimentUploads.id, uploadId));
  }

  const notificationsFor = (recipientId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, recipientId));

  function outcomeOf(uploadId: string, overrides: Partial<UploadOutcome> = {}): UploadOutcome {
    return {
      uploadId,
      outcome: "completed",
      rowCount: 5_000_000_000,
      rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
      errorCode: null,
      ...overrides,
    };
  }

  const exitWith = (result: string): DatabricksJobRunOutputResponse => ({
    notebook_output: { result },
  });

  const outcome = (uploadId: string, overrides?: Partial<UploadOutcome>) =>
    exitWith(JSON.stringify(outcomeOf(uploadId, overrides)));

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    reconciler = testApp.module.get(UploadRunReconcilerService);
    uploadsRepository = testApp.module.get(ExperimentDataUploadsRepository);
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

  it.each([
    [JobLifecycleState.QUEUED, "queued"],
    [JobLifecycleState.BLOCKED, "queued"],
    [JobLifecycleState.PENDING, "pending"],
    [JobLifecycleState.WAITING_FOR_RETRY, "pending"],
    [JobLifecycleState.RUNNING, "running"],
    [JobLifecycleState.TERMINATING, "running"],
  ])("shows a %s run as %s", async (lifeCycleState, status) => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(run(lifeCycleState)));

    await reconciler.reconcile();

    expect((await stored(uploadId)).status).toBe(status);
  });

  it("completes a succeeded run from the outcome it exited with and tells the uploader once", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    const output = vi
      .spyOn(databricksPort, "getJobRunOutput")
      .mockResolvedValue(success(outcome(uploadId)));

    await reconciler.reconcile();
    await reconciler.reconcile();

    expect(output).toHaveBeenCalledWith(TASK_RUN_ID);
    expect(await stored(uploadId)).toMatchObject({
      status: "completed",
      rowCount: 5_000_000_000,
      rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
      errorCode: null,
    });
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({
        type: "data_upload_completed",
        actorId: null,
        resourceType: "experiment",
        resourceId: experimentId,
        params: { experimentName: "Drought trial" },
      }),
    ]);
  });

  it("reads the outcome of the run's last attempt", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(
        run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS, [
          {
            run_id: 11,
            task_key: "process_upload",
            attempt_number: 0,
            state: { life_cycle_state: "TERMINATED" },
          },
          {
            run_id: 12,
            task_key: "process_upload",
            attempt_number: 1,
            state: { life_cycle_state: "TERMINATED" },
          },
        ]),
      ),
    );
    const output = vi
      .spyOn(databricksPort, "getJobRunOutput")
      .mockResolvedValue(success(outcome(uploadId)));

    await reconciler.reconcile();

    expect(output).toHaveBeenCalledWith(12);
    expect((await stored(uploadId)).status).toBe("completed");
  });

  it("fails a succeeded run that reports a failed upload, naming the table to the uploader", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(
      success(
        outcome(uploadId, {
          outcome: "failed",
          rowCount: 0,
          rejectedFiles: [{ name: "empty.csv", reason: "no_rows" }],
          errorCode: "no_rows",
        }),
      ),
    );

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({
      status: "failed",
      errorCode: "no_rows",
      rejectedFiles: [{ name: "empty.csv", reason: "no_rows" }],
    });
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({
        type: "data_upload_failed",
        params: { experimentName: "Drought trial", tableName: "leaf_traits" },
      }),
    ]);
  });

  it("fails a reported failure without a reason as unknown", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(
      success(outcome(uploadId, { outcome: "failed", rowCount: 0, errorCode: null })),
    );

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it.each([
    ["missing", success({})],
    ["unreadable", success(exitWith("{not json"))],
    ["malformed", success(exitWith(JSON.stringify({ outcome: "completed" })))],
    [
      "for another upload",
      success(exitWith(JSON.stringify(outcomeOf("11111111-1111-1111-1111-111111111111")))),
    ],
  ])("fails a succeeded run whose outcome is %s", async (_case, outputResult) => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(outputResult);

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it("fails a succeeded run that lists no task to read the outcome from", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS, [])),
    );

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it("reads an outcome the Jobs API would not hand over again on the next pass", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput")
      .mockResolvedValueOnce(failure(AppError.internal("Databricks unavailable")))
      .mockResolvedValueOnce(success(outcome(uploadId)));

    await reconciler.reconcile();
    expect((await stored(uploadId)).status).toBe("queued");
    expect(await notificationsFor(userId)).toHaveLength(0);

    await reconciler.reconcile();
    expect((await stored(uploadId)).status).toBe("completed");
  });

  it.each([
    [JobLifecycleState.TERMINATED, JobResultState.CANCELED],
    [JobLifecycleState.TERMINATED, JobResultState.FAILED],
    [JobLifecycleState.TERMINATED, JobResultState.TIMEOUT],
    [JobLifecycleState.INTERNAL_ERROR, undefined],
    [JobLifecycleState.SKIPPED, undefined],
  ])("fails a %s %s run as unknown", async (lifeCycleState, resultState) => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(lifeCycleState, resultState)),
    );
    const output = vi.spyOn(databricksPort, "getJobRunOutput");

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({ status: "failed", errorCode: "unknown" });
    expect(output).not.toHaveBeenCalled();
  });

  it("starts the run of an upload whose trigger never recorded one, with the parameters it was first sent", async () => {
    const uploadId = await uploadInFlight(null, {
      sourceKind: "ambyte",
      uploadTableName: "ambyte_20260512",
    });
    const record = await stored(uploadId);
    const trigger = vi
      .spyOn(databricksPort, "triggerDataUploadJob")
      .mockResolvedValue(success({ run_id: 77, number_in_job: 1 }));

    await reconciler.reconcile();

    expect(trigger).toHaveBeenCalledWith({
      sourceKind: "ambyte",
      experimentId,
      experimentName: "Drought trial",
      uploadDirectory: "upload_20260101T000000_abcdef12",
      uploadId,
      uploadTableId: record.uploadTableId,
      uploadTableName: "ambyte_20260512",
      userId,
      createdAt: record.createdAt,
    });
    expect(await stored(uploadId)).toMatchObject({ status: "queued", jobRunId: 77 });
  });

  it("keeps trying to start a run until a quarter of an hour after the files arrived", async () => {
    const fresh = await uploadInFlight(null, { uploadTableName: "fresh" });
    const stale = await uploadInFlight(null, { uploadTableName: "stale" });
    // Received for twenty minutes, queued just now: still within the limit.
    await backdate(fresh, 20);
    await testApp.database
      .update(experimentUploads)
      .set({ updatedAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(experimentUploads.id, stale));
    vi.spyOn(databricksPort, "triggerDataUploadJob").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    await reconciler.reconcile();

    expect(await stored(fresh)).toMatchObject({ status: "queued", errorCode: null });
    expect(await stored(stale)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it("fails an upload that has received no file for an hour, however long ago it started", async () => {
    const progressing = await uploadReceiving({ uploadTableName: "progressing" });
    const stale = await uploadReceiving({ uploadTableName: "stale" });
    await backdate(progressing.id, 120);
    await stallTransfer(stale.id, 61);
    const trigger = vi.spyOn(databricksPort, "triggerDataUploadJob");

    await reconciler.reconcile();

    expect((await stored(progressing.id)).status).toBe("receiving");
    expect(await stored(stale.id)).toMatchObject({
      status: "failed",
      errorCode: "transfer_interrupted",
    });
    expect(trigger).not.toHaveBeenCalled();
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({ type: "data_upload_failed" }),
    ]);
  });

  it("leaves a transfer its request queued after the sweep read it as stalled", async () => {
    const record = await uploadReceiving();
    await stallTransfer(record.id, 61);
    const readAsStalled = await uploadsRepository.findInFlight();
    await uploadsRepository.markQueued(record.id, 2);
    // Old activity as well, so only the status keeps it from the sweep.
    await stallTransfer(record.id, 61);
    vi.spyOn(uploadsRepository, "findInFlight").mockResolvedValue(readAsStalled);

    await reconciler.reconcile();

    expect(await stored(record.id)).toMatchObject({ status: "queued", errorCode: null });
    expect(await notificationsFor(userId)).toHaveLength(0);
  });

  it("does not announce a failure the upload's request already reported", async () => {
    const record = await uploadReceiving();
    await uploadsRepository.failAnnounced(record.id, "no_files");

    await reconciler.reconcile();

    expect((await stored(record.id)).status).toBe("failed");
    expect(await notificationsFor(userId)).toHaveLength(0);
  });

  it("gives up on a run that has been in flight for two days", async () => {
    const uploadId = await uploadInFlight();
    await backdate(uploadId, 49 * 60);
    const statusCheck = vi.spyOn(databricksPort, "getJobRunStatus");

    await reconciler.reconcile();

    expect(await stored(uploadId)).toMatchObject({ status: "failed", errorCode: "unknown" });
    expect(statusCheck).not.toHaveBeenCalled();
  });

  it("follows the other uploads when one of them throws", async () => {
    const broken = await uploadInFlight(RUN_ID, { uploadTableName: "broken" });
    const healthy = await uploadInFlight(RUN_ID + 1, { uploadTableName: "healthy" });
    vi.spyOn(databricksPort, "getJobRunStatus").mockImplementation((runId) =>
      runId === RUN_ID
        ? Promise.reject(new Error("socket hang up"))
        : Promise.resolve(success(run(JobLifecycleState.RUNNING))),
    );

    await reconciler.reconcile();

    expect((await stored(broken)).status).toBe("queued");
    expect((await stored(healthy)).status).toBe("running");
  });

  it("tells only the uploader how the upload ended", async () => {
    const memberId = await testApp.createTestUser({});
    await testApp.addExperimentCollaborator(experimentId, memberId);
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(success(outcome(uploadId)));

    await reconciler.reconcile();

    expect(await notificationsFor(userId)).toHaveLength(1);
    expect(await notificationsFor(memberId)).toHaveLength(0);
  });

  it("announces an outcome on a later pass when its notification could not be stored", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(success(outcome(uploadId)));
    vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValueOnce(
      failure(AppError.internal("Database unavailable")),
    );

    await reconciler.reconcile();
    expect((await stored(uploadId)).status).toBe("completed");
    expect((await stored(uploadId)).announcedAt).toBeNull();
    expect(await notificationsFor(userId)).toHaveLength(0);

    await reconciler.reconcile();
    expect((await stored(uploadId)).announcedAt).toBeInstanceOf(Date);
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({ type: "data_upload_completed" }),
    ]);
  });

  it("announces only outcomes that finished within the last day", async () => {
    const recent = await uploadInFlight(RUN_ID, { uploadTableName: "recent" });
    const old = await uploadInFlight(RUN_ID + 1, { uploadTableName: "old" });
    await uploadsRepository.fail(recent, "unknown");
    await uploadsRepository.fail(old, "unknown");
    await finishedAgo(recent, 23);
    await finishedAgo(old, 25);

    await reconciler.reconcile();

    expect((await stored(recent)).announcedAt).toBeInstanceOf(Date);
    expect((await stored(old)).announcedAt).toBeNull();
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({
        type: "data_upload_failed",
        params: { experimentName: "Drought trial", tableName: "recent" },
      }),
    ]);
  });

  it("lets go of an upload carried over from the old history without a notification", async () => {
    const [carriedOver] = await testApp.database
      .insert(experimentUploads)
      .values({
        experimentId,
        sourceKind: "csv",
        status: "completed",
        createdBy: userId,
        completedAt: new Date(),
      })
      .returning();

    await reconciler.reconcile();

    expect((await stored(carriedOver.id)).announcedAt).toBeInstanceOf(Date);
    expect(await notificationsFor(userId)).toHaveLength(0);
  });

  it("lets go of an upload whose experiment was deleted without a notification", async () => {
    const uploadId = await uploadInFlight();
    await uploadsRepository.fail(uploadId, "unknown");
    vi.spyOn(testApp.module.get(ExperimentRepository), "findOne").mockResolvedValue(success(null));

    await reconciler.reconcile();

    expect((await stored(uploadId)).announcedAt).toBeInstanceOf(Date);
    expect(await notificationsFor(userId)).toHaveLength(0);
  });

  it("reads every outcome the upload job's tests exit with", () => {
    const fixtures = zOutcomeFixtures.parse(JSON.parse(readFileSync(OUTCOME_FIXTURES, "utf-8")));

    const unreadable = fixtures
      .filter((fixture) => !uploadOutcomeSchema.safeParse(fixture.outcome).success)
      .map((fixture) => fixture.case);

    expect(fixtures.length).toBeGreaterThan(0);
    expect(unreadable).toEqual([]);
  });

  it("notifies once when two backend tasks finish the same upload at the same time", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(succeededRun()));
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(success(outcome(uploadId)));
    const otherTask = new UploadRunReconcilerService(
      uploadsRepository,
      testApp.module.get(ExperimentRepository),
      databricksPort,
      testApp.module.get(NotificationDispatchService),
    );

    await Promise.all([reconciler.reconcile(), otherTask.reconcile()]);

    expect((await stored(uploadId)).status).toBe("completed");
    expect(await notificationsFor(userId)).toHaveLength(1);
  });

  it("tries again on the next pass when the run cannot be read", async () => {
    const uploadId = await uploadInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    await reconciler.reconcile();

    expect((await stored(uploadId)).status).toBe("queued");
    expect(await notificationsFor(userId)).toHaveLength(0);
  });
});
