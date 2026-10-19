import { eq, experimentExports, notifications } from "@repo/database";

import type { DatabricksJobRunStatusResponse } from "../../../common/modules/databricks/services/jobs/jobs.types";
import {
  JobLifecycleState,
  JobResultState,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { TestHarness } from "../../../test/test-harness";
import type { ExportFormat, ExportManifest } from "../../core/models/experiment-data-exports.model";
import { AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import { ExperimentDataExportsRepository } from "../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { ExportRunReconcilerService } from "./export-run-reconciler.service";

const RUN_ID = 4242;

function run(
  lifeCycleState: JobLifecycleState,
  resultState?: JobResultState,
  tasks?: DatabricksJobRunStatusResponse["tasks"],
): DatabricksJobRunStatusResponse {
  return {
    run_id: RUN_ID,
    state: { life_cycle_state: lifeCycleState, state_message: "", result_state: resultState },
    tasks,
  };
}

describe("ExportRunReconcilerService", () => {
  const testApp = TestHarness.App;
  let reconciler: ExportRunReconcilerService;
  let exportsRepository: ExperimentDataExportsRepository;
  let databricksPort: DatabricksPort;
  let awsPort: AwsPort;
  let userId: string;
  let experimentId: string;

  async function exportInFlight(
    jobRunId: number | null = RUN_ID,
    format: ExportFormat = "parquet",
  ) {
    const recorded = await exportsRepository.createOrJoinInFlight({
      experimentId,
      tableName: "raw_data",
      format,
      anonymizeContributors: false,
      createdBy: userId,
    });
    assertSuccess(recorded);
    const exportId = recorded.value.record.id;
    if (jobRunId !== null) {
      await exportsRepository.attachRun(exportId, jobRunId);
    }
    return exportId;
  }

  async function stored(exportId: string) {
    const [row] = await testApp.database
      .select()
      .from(experimentExports)
      .where(eq(experimentExports.id, exportId));
    return row;
  }

  const notificationsFor = (recipientId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, recipientId));

  function manifestOf(exportId: string, rowCount = 1_500_000): ExportManifest {
    return {
      exportId,
      format: "parquet",
      rowCount,
      snapshotAt: new Date().toISOString(),
      parts:
        rowCount === 0
          ? []
          : [
              { name: "part-00000.snappy.parquet", sizeBytes: 3_000_000_000 },
              { name: "part-00001.snappy.parquet", sizeBytes: 1_000_000_000 },
            ],
    };
  }

  const manifest = (exportId: string, rowCount?: number) =>
    JSON.stringify(manifestOf(exportId, rowCount));

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    reconciler = testApp.module.get(ExportRunReconcilerService);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
    awsPort = testApp.module.get(AWS_PORT);
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
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(success(run(lifeCycleState)));

    await reconciler.reconcile();

    expect((await stored(exportId)).status).toBe(status);
  });

  it("completes a succeeded run from its manifest and tells the exporter once", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    const read = vi
      .spyOn(awsPort, "readExportObject")
      .mockResolvedValue(success(manifest(exportId)));

    await reconciler.reconcile();
    await reconciler.reconcile();

    expect(read).toHaveBeenCalledWith(
      `exports/${experimentId}/raw_data/parquet/${exportId}/manifest.json`,
    );
    expect(await stored(exportId)).toMatchObject({
      status: "completed",
      rowCount: 1_500_000,
      totalBytes: 4_000_000_000,
    });
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({
        type: "data_export_completed",
        resourceType: "experiment",
        resourceId: experimentId,
        params: { experimentName: "Drought trial", format: "parquet" },
      }),
    ]);
  });

  it("fails a succeeded run whose table had no rows", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    vi.spyOn(awsPort, "readExportObject").mockResolvedValue(success(manifest(exportId, 0)));

    await reconciler.reconcile();

    expect(await stored(exportId)).toMatchObject({ status: "failed", errorCode: "no_data" });
    expect(await notificationsFor(userId)).toEqual([
      expect.objectContaining({ type: "data_export_failed" }),
    ]);
  });

  it.each([
    ["missing", success(null)],
    ["unreadable", success("{not json")],
    ["for another export", success(manifest("11111111-1111-1111-1111-111111111111"))],
  ])("fails a succeeded run whose manifest is %s", async (_case, readResult) => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    vi.spyOn(awsPort, "readExportObject").mockResolvedValue(readResult);

    await reconciler.reconcile();

    expect(await stored(exportId)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it("reads a manifest the bucket would not hand over again on the next pass", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    vi.spyOn(awsPort, "readExportObject")
      .mockResolvedValueOnce(failure(AppError.internal("Slow Down", "AWS_S3_READ_FAILED")))
      .mockResolvedValueOnce(success(manifest(exportId)));

    await reconciler.reconcile();
    expect((await stored(exportId)).status).toBe("queued");
    expect(await notificationsFor(userId)).toHaveLength(0);

    await reconciler.reconcile();
    expect((await stored(exportId)).status).toBe("completed");
  });

  it("fails a failed run with the reason its last attempt raised", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(
        run(JobLifecycleState.TERMINATED, JobResultState.FAILED, [
          {
            run_id: 11,
            task_key: "export_data",
            attempt_number: 0,
            state: { life_cycle_state: "TERMINATED" },
          },
          {
            run_id: 12,
            task_key: "export_data",
            attempt_number: 1,
            state: { life_cycle_state: "TERMINATED" },
          },
        ]),
      ),
    );
    const output = vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(
      success({
        error:
          "ExportError: EXPORT_ERROR[too_many_rows_for_format] 2000000 rows exceed the 1048575-row limit of xlsx",
      }),
    );

    await reconciler.reconcile();

    expect(output).toHaveBeenCalledWith(12);
    expect(await stored(exportId)).toMatchObject({
      status: "failed",
      errorCode: "too_many_rows_for_format",
    });
  });

  it.each([
    [
      "an error without a reason",
      success({ error: "[TASK_WRITE_FAILED] Task failed while writing rows" }),
    ],
    ["an unknown reason", success({ error: "EXPORT_ERROR[disk_full] no space left" })],
    ["no readable output", failure(AppError.internal("Databricks unavailable"))],
  ])("fails a failed run with %s as unknown", async (_case, outputResult) => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(
        run(JobLifecycleState.TERMINATED, JobResultState.FAILED, [
          { run_id: 11, task_key: "export_data", state: { life_cycle_state: "TERMINATED" } },
        ]),
      ),
    );
    vi.spyOn(databricksPort, "getJobRunOutput").mockResolvedValue(outputResult);

    await reconciler.reconcile();

    expect(await stored(exportId)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it.each([
    [JobLifecycleState.TERMINATED, JobResultState.CANCELED],
    [JobLifecycleState.TERMINATED, JobResultState.FAILED],
    [JobLifecycleState.INTERNAL_ERROR, undefined],
    [JobLifecycleState.SKIPPED, undefined],
  ])("fails a %s %s run", async (lifeCycleState, resultState) => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(lifeCycleState, resultState)),
    );

    await reconciler.reconcile();

    expect((await stored(exportId)).status).toBe("failed");
  });

  it("starts the run of an export whose trigger never recorded one", async () => {
    const exportId = await exportInFlight(null);
    const trigger = vi
      .spyOn(databricksPort, "triggerDataExportJob")
      .mockResolvedValue(success({ run_id: 77, number_in_job: 1 }));

    await reconciler.reconcile();

    expect(trigger).toHaveBeenCalledWith({
      exportId,
      experimentId,
      tableName: "raw_data",
      format: "parquet",
      userId,
      anonymizeContributors: false,
    });
    expect(await stored(exportId)).toMatchObject({ status: "queued", jobRunId: 77 });
  });

  it("keeps trying to start a run until the export is a quarter of an hour old", async () => {
    const fresh = await exportInFlight(null);
    const stale = await exportInFlight(null, "csv");
    await testApp.database
      .update(experimentExports)
      .set({ createdAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(experimentExports.id, stale));
    vi.spyOn(databricksPort, "triggerDataExportJob").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    await reconciler.reconcile();

    expect((await stored(fresh)).status).toBe("queued");
    expect(await stored(stale)).toMatchObject({ status: "failed", errorCode: "unknown" });
  });

  it("gives up on a run that has been in flight for two days", async () => {
    const exportId = await exportInFlight();
    await testApp.database
      .update(experimentExports)
      .set({ createdAt: new Date(Date.now() - 49 * 60 * 60_000) })
      .where(eq(experimentExports.id, exportId));
    const statusCheck = vi.spyOn(databricksPort, "getJobRunStatus");

    await reconciler.reconcile();

    expect(await stored(exportId)).toMatchObject({ status: "failed", errorCode: "unknown" });
    expect(statusCheck).not.toHaveBeenCalled();
  });

  it("follows the other exports when one of them throws", async () => {
    const broken = await exportInFlight();
    const healthy = await exportInFlight(RUN_ID + 1, "csv");
    vi.spyOn(databricksPort, "getJobRunStatus").mockImplementation((runId) =>
      runId === RUN_ID
        ? Promise.reject(new Error("socket hang up"))
        : Promise.resolve(success(run(JobLifecycleState.RUNNING))),
    );

    await reconciler.reconcile();

    expect((await stored(broken)).status).toBe("queued");
    expect((await stored(healthy)).status).toBe("running");
  });

  it("tells everyone who asked for the export how it ended", async () => {
    const exportId = await exportInFlight();
    const joinerId = await testApp.createTestUser({});
    await exportsRepository.createOrJoinInFlight({
      experimentId,
      tableName: "raw_data",
      format: "parquet",
      anonymizeContributors: false,
      createdBy: joinerId,
    });
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    vi.spyOn(awsPort, "readExportObject").mockResolvedValue(success(manifest(exportId)));

    await reconciler.reconcile();

    expect(await notificationsFor(userId)).toHaveLength(1);
    expect(await notificationsFor(joinerId)).toEqual([
      expect.objectContaining({ type: "data_export_completed" }),
    ]);
  });

  it("notifies once when two backend tasks finish the same export at the same time", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      success(run(JobLifecycleState.TERMINATED, JobResultState.SUCCESS)),
    );
    vi.spyOn(awsPort, "readExportObject").mockResolvedValue(success(manifest(exportId)));
    const otherTask = new ExportRunReconcilerService(
      exportsRepository,
      testApp.module.get(ExperimentRepository),
      databricksPort,
      awsPort,
      testApp.module.get(NotificationDispatchService),
    );

    await Promise.all([reconciler.reconcile(), otherTask.reconcile()]);

    expect((await stored(exportId)).status).toBe("completed");
    expect(await notificationsFor(userId)).toHaveLength(1);
  });

  it("tries again on the next pass when the run cannot be read", async () => {
    const exportId = await exportInFlight();
    vi.spyOn(databricksPort, "getJobRunStatus").mockResolvedValue(
      failure(AppError.internal("Databricks unavailable")),
    );

    await reconciler.reconcile();

    expect((await stored(exportId)).status).toBe("queued");
    expect(await notificationsFor(userId)).toHaveLength(0);
  });

  it("expires completed exports past their retention", async () => {
    const exportId = await exportInFlight();
    await exportsRepository.complete(exportId, manifestOf(exportId));
    await testApp.database
      .update(experimentExports)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentExports.id, exportId));

    await reconciler.reconcile();

    expect((await stored(exportId)).status).toBe("expired");
  });
});
