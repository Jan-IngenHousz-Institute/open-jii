import { faker } from "@faker-js/faker";

import { eq, experimentExports } from "@repo/database";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { GetExportDownloadLinksUseCase } from "./get-export-download-links";

describe("GetExportDownloadLinksUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let experimentId: string;
  let useCase: GetExportDownloadLinksUseCase;
  let exportsRepository: ExperimentDataExportsRepository;
  let awsPort: AwsPort;

  async function exportWithParts(parts: { name: string; sizeBytes: number }[]) {
    const recorded = await exportsRepository.createOrJoinInFlight({
      experimentId,
      tableName: "raw_data",
      format: "csv",
      anonymizeContributors: false,
      createdBy: userId,
    });
    assertSuccess(recorded);
    const exportId = recorded.value.record.id;
    await exportsRepository.complete(exportId, {
      exportId,
      format: "csv",
      rowCount: 1_500_000,
      snapshotAt: new Date().toISOString(),
      parts,
    });
    return exportId;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Drought trial", userId });
    experimentId = experiment.id;
    useCase = testApp.module.get(GetExportDownloadLinksUseCase);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);
    awsPort = testApp.module.get(AWS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("signs one link per part, named so the parts sort in order", async () => {
    const exportId = await exportWithParts([
      { name: "part-00000-tid-1-c000.csv.gz", sizeBytes: 900 },
      { name: "part-00001-tid-1-c000.csv.gz", sizeBytes: 100 },
    ]);
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const sign = vi
      .spyOn(awsPort, "getExportDownloadUrl")
      .mockImplementation((key) =>
        Promise.resolve(success({ url: `https://s3.test/${key}`, expiresAt })),
      );

    const result = await useCase.execute(experimentId, exportId);

    assertSuccess(result);
    const folder = `exports/${experimentId}/raw_data/csv/${exportId}`;
    expect(result.value.parts.map(({ fileName: _fileName, ...link }) => link)).toEqual([
      { index: 0, sizeBytes: 900, url: `https://s3.test/${folder}/part-00000-tid-1-c000.csv.gz` },
      { index: 1, sizeBytes: 100, url: `https://s3.test/${folder}/part-00001-tid-1-c000.csv.gz` },
    ]);
    const [first, second] = result.value.parts.map((link) => link.fileName);
    expect(first).toMatch(/^drought-trial_raw-data_\d{8}_\d{6}_part-1-of-2\.csv\.gz$/);
    expect(second).toMatch(/_part-2-of-2\.csv\.gz$/);
    expect(result.value.expiresAt).toBe(expiresAt.toISOString());
    expect(sign).toHaveBeenCalledTimes(2);
  });

  it("names a single-part export without a part suffix", async () => {
    const exportId = await exportWithParts([{ name: "part-00000.xlsx", sizeBytes: 10 }]);
    vi.spyOn(awsPort, "getExportDownloadUrl").mockResolvedValue(
      success({ url: "https://s3.test/x", expiresAt: new Date() }),
    );

    const result = await useCase.execute(experimentId, exportId);

    assertSuccess(result);
    expect(result.value.parts[0].fileName).toMatch(/^drought-trial_raw-data_\d{8}_\d{6}\.xlsx$/);
  });

  it("refuses an export that has not finished", async () => {
    const recorded = await exportsRepository.createOrJoinInFlight({
      experimentId,
      tableName: "raw_data",
      format: "csv",
      anonymizeContributors: false,
      createdBy: userId,
    });
    assertSuccess(recorded);

    const result = await useCase.execute(experimentId, recorded.value.record.id);

    assertFailure(result);
    expect(result.error.code).toBe("EXPORT_NOT_READY");
  });

  it("refuses an export whose files have expired", async () => {
    const exportId = await exportWithParts([{ name: "part-00000.csv.gz", sizeBytes: 10 }]);
    await testApp.database
      .update(experimentExports)
      .set({ status: "expired" })
      .where(eq(experimentExports.id, exportId));

    const result = await useCase.execute(experimentId, exportId);

    assertFailure(result);
    expect(result.error.code).toBe("EXPORT_EXPIRED");
  });

  it("refuses a completed export past its expiry before the reconciler marks it expired", async () => {
    const exportId = await exportWithParts([{ name: "part-00000.csv.gz", sizeBytes: 10 }]);
    await testApp.database
      .update(experimentExports)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentExports.id, exportId));

    const result = await useCase.execute(experimentId, exportId);

    assertFailure(result);
    expect(result.error.code).toBe("EXPORT_EXPIRED");
  });

  it("returns not found for an export of another experiment", async () => {
    const exportId = await exportWithParts([{ name: "part-00000.csv.gz", sizeBytes: 10 }]);
    const { experiment: other } = await testApp.createExperiment({ name: "Other", userId });

    const result = await useCase.execute(other.id, exportId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns not found when the experiment does not exist", async () => {
    const result = await useCase.execute(faker.string.uuid(), faker.string.uuid());

    assertFailure(result);
    expect(result.error.message).toBe("Experiment not found");
  });

  it("fails when a link cannot be signed", async () => {
    const exportId = await exportWithParts([{ name: "part-00000.csv.gz", sizeBytes: 10 }]);
    vi.spyOn(awsPort, "getExportDownloadUrl").mockResolvedValue(
      failure(AppError.internal("Credentials expired", "AWS_S3_PRESIGN_FAILED")),
    );

    const result = await useCase.execute(experimentId, exportId);

    assertFailure(result);
    expect(result.error.code).toBe("AWS_S3_PRESIGN_FAILED");
    expect(result.error.message).toBe("Could not prepare the download links");
  });
});
