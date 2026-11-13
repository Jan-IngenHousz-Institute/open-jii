import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { ExperimentMetadataRepository } from "../../../core/repositories/experiment-metadata.repository";
import { CreateExperimentMetadataUseCase } from "./create-experiment-metadata";
import { GetExperimentMetadataUseCase } from "./get-experiment-metadata";

describe("GetExperimentMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentMetadataUseCase;

  async function save(experimentId: string, location: string) {
    const created = await testApp.module
      .get(CreateExperimentMetadataUseCase)
      .execute(experimentId, { metadata: { location } }, testUserId);
    assertSuccess(created);
    return created.value;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentMetadataUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists a sheet as soon as it is saved, newest first, without the warehouse", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Fetch Test",
      userId: testUserId,
    });
    const query = vi.spyOn(testApp.module.get<DatabricksPort>(DATABRICKS_PORT), "executeSqlQuery");
    const first = await save(experiment.id, "GH 8.3");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await save(experiment.id, "GH 8.4");

    const result = await useCase.execute(experiment.id, testUserId);

    assertSuccess(result);
    expect(result.value.map(({ metadataId }) => metadataId)).toEqual([
      second.metadataId,
      first.metadataId,
    ]);
    expect(result.value[0]).toEqual(
      expect.objectContaining({
        experimentId: experiment.id,
        metadata: { location: "GH 8.4" },
        createdBy: testUserId,
      }),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("returns an empty list when the experiment has no sheets", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "No Metadata Test",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, testUserId);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("lists a public experiment's sheets to a non-member", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Public Metadata Test",
      userId: testUserId,
      visibility: "public",
    });
    const saved = await save(experiment.id, "GH 8.3");
    const otherUserId = await testApp.createTestUser({});

    const result = await useCase.execute(experiment.id, otherUserId);

    assertSuccess(result);
    expect(result.value.map(({ metadataId }) => metadataId)).toEqual([saved.metadataId]);
  });

  it("refuses an experiment that does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("passes on a failed Postgres read", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Metadata Fetch Failure Test",
      userId: testUserId,
    });
    vi.spyOn(
      testApp.module.get(ExperimentMetadataRepository),
      "findByExperimentId",
    ).mockResolvedValue(
      failure(AppError.internal("Postgres did not answer the metadata sheets query")),
    );

    const result = await useCase.execute(experiment.id, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
