import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ListExportsUseCase } from "./list-exports";

describe("ListExportsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExportsUseCase;
  let exportsRepository: ExperimentDataExportsRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExportsUseCase);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists the table's exports in the API's shape", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Exports", userId: testUserId });
    const recorded = await exportsRepository.createOrJoinInFlight({
      experimentId: experiment.id,
      tableName: "raw_data",
      format: "parquet",
      anonymizeContributors: false,
      createdBy: testUserId,
    });
    assertSuccess(recorded);
    await exportsRepository.complete(recorded.value.record.id, {
      exportId: recorded.value.record.id,
      format: "parquet",
      rowCount: 2_000_000,
      snapshotAt: new Date().toISOString(),
      parts: [
        { name: "part-00000.snappy.parquet", sizeBytes: 900 },
        { name: "part-00001.snappy.parquet", sizeBytes: 100 },
      ],
    });

    const result = await useCase.execute(experiment.id, testUserId, { tableName: "raw_data" });

    assertSuccess(result);
    expect(result.value.exports).toEqual([
      expect.objectContaining({
        exportId: recorded.value.record.id,
        status: "completed",
        rowCount: 2_000_000,
        totalBytes: 1000,
        partCount: 2,
        errorCode: null,
      }),
    ]);
  });

  it("returns an empty list for a table with no exports", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Empty", userId: testUserId });

    const result = await useCase.execute(experiment.id, testUserId, { tableName: "raw_data" });

    assertSuccess(result);
    expect(result.value.exports).toEqual([]);
  });

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), testUserId, {
      tableName: "raw_data",
    });

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
