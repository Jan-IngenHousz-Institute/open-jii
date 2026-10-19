import { faker } from "@faker-js/faker";

import { experimentExports } from "@repo/database";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { InitiateExportUseCase } from "./initiate-export";

describe("InitiateExportUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: InitiateExportUseCase;
  let databricksPort: DatabricksPort;

  const storedExports = () => testApp.database.select().from(experimentExports);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(InitiateExportUseCase);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("records the export and starts its run under the export's id", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Export_Experiment",
      userId: testUserId,
    });
    const trigger = vi
      .spyOn(databricksPort, "triggerDataExportJob")
      .mockResolvedValue(success({ run_id: 4242, number_in_job: 1 }));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "csv",
    });

    assertSuccess(result);
    expect(result.value).toMatchObject({
      experimentId: experiment.id,
      tableName: "raw_data",
      format: "csv",
      status: "queued",
      createdBy: testUserId,
    });
    expect(trigger).toHaveBeenCalledWith({
      exportId: result.value.exportId,
      experimentId: experiment.id,
      tableName: "raw_data",
      format: "csv",
      userId: testUserId,
      anonymizeContributors: false,
    });

    const [stored] = await storedExports();
    expect(stored).toMatchObject({ id: result.value.exportId, jobRunId: 4242, status: "queued" });
  });

  it("joins the export already in flight instead of starting a second run", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Twice", userId: testUserId });
    const trigger = vi
      .spyOn(databricksPort, "triggerDataExportJob")
      .mockResolvedValue(success({ run_id: 4242, number_in_job: 1 }));

    const first = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "parquet",
    });
    const second = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "parquet",
    });

    assertSuccess(first);
    assertSuccess(second);
    expect(second.value.exportId).toBe(first.value.exportId);
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(await storedExports()).toHaveLength(1);
  });

  it("uses the experiment's anonymisation setting unless the export overrides it", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Anonymised",
      userId: testUserId,
      anonymizeContributors: true,
    });
    const trigger = vi
      .spyOn(databricksPort, "triggerDataExportJob")
      .mockResolvedValue(success({ run_id: 1, number_in_job: 1 }));

    await useCase.execute(experiment.id, testUserId, { tableName: "raw_data", format: "csv" });
    await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "ndjson",
      anonymizeContributors: false,
    });

    expect(trigger.mock.calls.map(([input]) => input.anonymizeContributors)).toEqual([true, false]);
  });

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), testUserId, {
      tableName: "raw_data",
      format: "csv",
    });

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(await storedExports()).toHaveLength(0);
  });

  it("leaves the export queued for the reconciler when its run cannot be started", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Broken", userId: testUserId });
    vi.spyOn(databricksPort, "triggerDataExportJob").mockResolvedValue(
      failure(AppError.internal("Job trigger timed out")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "csv",
    });

    assertSuccess(result);
    expect(result.value.status).toBe("queued");
    const [stored] = await storedExports();
    expect(stored).toMatchObject({ status: "queued", jobRunId: null, errorCode: null });
  });

  it("adds whoever asks for an export already in flight to the people told how it ends", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Shared", userId: testUserId });
    const colleagueId = await testApp.createTestUser({});
    vi.spyOn(databricksPort, "triggerDataExportJob").mockResolvedValue(
      success({ run_id: 7, number_in_job: 1 }),
    );

    await useCase.execute(experiment.id, testUserId, { tableName: "raw_data", format: "csv" });
    await useCase.execute(experiment.id, colleagueId, { tableName: "raw_data", format: "csv" });
    await useCase.execute(experiment.id, colleagueId, { tableName: "raw_data", format: "csv" });

    const [stored] = await storedExports();
    expect(stored).toMatchObject({ createdBy: testUserId, watcherIds: [colleagueId] });
  });
});
