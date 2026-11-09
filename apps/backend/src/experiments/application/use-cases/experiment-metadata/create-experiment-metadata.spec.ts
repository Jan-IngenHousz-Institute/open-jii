import { experimentDataOutbox, experimentMetadataSheets } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateExperimentMetadataDto } from "../../../core/models/experiment-metadata.model";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { ExperimentDataOutboxWorker } from "../../services/experiment-data-outbox.worker";
import { CreateExperimentMetadataUseCase } from "./create-experiment-metadata";

describe("CreateExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentMetadataUseCase;

  const sampleMetadata: CreateExperimentMetadataDto = {
    metadata: { location: "GH 8.3", sampleCount: 10 },
  };

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
    useCase = testApp.module.get(CreateExperimentMetadataUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("keeps the sheet, owes its copy and starts it, and returns it as kept", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    assertSuccess(result);
    const [kept] = await sheets();
    expect(kept).toEqual(
      expect.objectContaining({
        experimentId: experiment.id,
        metadata: sampleMetadata.metadata,
        createdBy: testUserId,
      }),
    );
    expect(result.value).toEqual(expect.objectContaining({ ...kept, metadataId: kept.id }));
    expect(await outbox()).toEqual([
      expect.objectContaining({
        recordType: "metadata_sheet",
        recordId: kept.id,
        destination: "lakehouse",
      }),
    ]);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it("lets an admin of the experiment create a sheet", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    const adminId = await testApp.createTestUser({});
    await testApp.addExperimentAdmin(experiment.id, adminId);

    const result = await useCase.execute(experiment.id, sampleMetadata, adminId);

    assertSuccess(result);
    expect(result.value.createdBy).toBe(adminId);
  });

  it("refuses a sheet on an archived experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
      status: "archived",
    });

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(await sheets()).toEqual([]);
  });

  it("answers not found for an experiment that does not exist", async () => {
    const result = await useCase.execute(
      "00000000-0000-0000-0000-000000000000",
      sampleMetadata,
      testUserId,
    );

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("fails, and owes no copy, when Postgres refuses the sheet", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: testUserId,
    });
    vi.spyOn(testApp.module.get(ExperimentMetadataRepository), "transaction").mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    const result = await useCase.execute(experiment.id, sampleMetadata, testUserId);

    assertFailure(result);
    expect(result.error.message).toBe("Postgres did not answer the metadata sheets query");
    expect(await outbox()).toEqual([]);
  });
});
