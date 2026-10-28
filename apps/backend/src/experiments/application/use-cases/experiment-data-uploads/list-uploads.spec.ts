import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataUploadsRepository } from "../../../core/repositories/experiment-data-uploads.repository";
import { ListUploadsUseCase } from "./list-uploads";

describe("ListUploadsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListUploadsUseCase;
  let uploadsRepository: ExperimentDataUploadsRepository;

  async function recordUpload(experimentId: string, uploadTableName: string) {
    const recorded = await uploadsRepository.create({
      id: faker.string.uuid(),
      experimentId,
      uploadTableId: faker.string.uuid(),
      uploadTableName,
      targetKind: "new",
      uploadDirectory: "upload_20260101T000000_abcdef12",
      sourceKind: "csv",
      createdBy: testUserId,
    });
    assertSuccess(recorded);
    return recorded.value;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListUploadsUseCase);
    uploadsRepository = testApp.module.get(ExperimentDataUploadsRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("lists the experiment's uploads in the API's shape", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Uploads", userId: testUserId });
    const record = await recordUpload(experiment.id, "greenhouse_temps");
    await uploadsRepository.markQueued(record.id, 2);
    const completed = await uploadsRepository.complete(record.id, {
      rowCount: 1000,
      rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
    });
    assertSuccess(completed);

    const result = await useCase.execute(experiment.id, testUserId, {});

    assertSuccess(result);
    expect(result.value.uploads).toEqual([
      {
        uploadId: record.id,
        experimentId: experiment.id,
        uploadTableId: record.uploadTableId,
        uploadTableName: "greenhouse_temps",
        sourceKind: "csv",
        status: "completed",
        fileCount: 2,
        rowCount: 1000,
        rejectedFiles: [{ name: "broken.csv", reason: "unparseable" }],
        errorCode: null,
        createdBy: testUserId,
        createdAt: record.createdAt.toISOString(),
        completedAt: completed.value?.completedAt?.toISOString(),
      },
    ]);
  });

  it("lists only the uploads of the table asked for", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Tables", userId: testUserId });
    const greenhouse = await recordUpload(experiment.id, "greenhouse_temps");
    await recordUpload(experiment.id, "soil_moisture");

    const result = await useCase.execute(experiment.id, testUserId, {
      uploadTableName: "greenhouse_temps",
    });

    assertSuccess(result);
    expect(result.value.uploads.map((upload) => upload.uploadId)).toEqual([greenhouse.id]);
  });

  it("returns an empty list for an experiment with no uploads", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Empty", userId: testUserId });

    const result = await useCase.execute(experiment.id, testUserId, {});

    assertSuccess(result);
    expect(result.value.uploads).toEqual([]);
  });

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), testUserId, {});

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
