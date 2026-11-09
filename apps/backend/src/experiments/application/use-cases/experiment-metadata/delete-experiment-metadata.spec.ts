import { experimentDataOutbox, experimentMetadataSheets } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { MetadataSheetRecord } from "../../../core/models/experiment-metadata.model";
import { ExperimentDataOutboxRepository } from "../../../core/repositories/experiment-data-outbox.repository";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";
import { DeleteExperimentMetadataUseCase } from "./delete-experiment-metadata";

describe("DeleteExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentMetadataUseCase;

  const created = new Date("2026-09-01T08:00:00.000Z");
  const sheetId = "0d2c4b6a-8e1f-4a3b-9c5d-7e9f1a3b5c7d";

  async function existing(experimentId: string): Promise<MetadataSheetRecord> {
    const record: MetadataSheetRecord = {
      id: sheetId,
      experimentId,
      metadata: { name: "Plots", columns: [], rows: [] },
      createdBy: testUserId,
      createdAt: created,
      updatedAt: created,
    };
    const repository = testApp.module.get(ExperimentMetadataRepository);
    assertSuccess(await repository.transaction((tx) => repository.insert(tx, record)));
    return record;
  }

  function sheets() {
    return testApp.database.select().from(experimentMetadataSheets);
  }

  function outbox() {
    return testApp.database.select().from(experimentDataOutbox);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentMetadataUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("deletes the sheet, owes its copy's delete and starts it", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    await existing(experiment.id);
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    assertSuccess(await useCase.execute(experiment.id, sheetId, testUserId));

    expect(await sheets()).toEqual([]);
    expect(await outbox()).toEqual([
      expect.objectContaining({ recordType: "metadata_sheet", recordId: sheetId }),
    ]);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("succeeds, and owes no copy, when the sheet is already gone", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });

    assertSuccess(await useCase.execute(experiment.id, sheetId, testUserId));

    expect(await outbox()).toEqual([]);
  });

  it("refuses a delete on an archived experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
      status: "archived",
    });

    const result = await useCase.execute(experiment.id, sheetId, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("answers not found for an experiment that does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      sheetId,
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
    vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "transaction").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    const result = await useCase.execute(experiment.id, sheetId, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("keeps the sheet when the copy it owes cannot be written", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const record = await existing(experiment.id);
    vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
      new Error("outbox unavailable"),
    );

    const result = await useCase.execute(experiment.id, record.id, testUserId);

    assertFailure(result);
    expect(await sheets()).toEqual([record]);
    expect(await outbox()).toEqual([]);
  });
});
