import { faker } from "@faker-js/faker";
import { Readable } from "stream";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { DownloadExportUseCase } from "./download-export";

describe("DownloadExportUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DownloadExportUseCase;
  let exportsRepository: ExperimentDataExportsRepository;

  const mockStream = () =>
    new Readable({
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      read() {},
    });

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DownloadExportUseCase);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should name the download after the experiment, table and completion time", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Léaf Photosynthesis 2026",
      userId: testUserId,
    });
    const exportId = faker.string.uuid();
    const stream = mockStream();
    const filePath = `/volumes/catalog/centrum/data-exports/${experiment.id}/raw_data/csv/${exportId}/raw_data.csv`;

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      success({
        stream,
        filePath,
        tableName: "raw_data",
        completedAt: "2026-01-02T03:04:05Z",
      }),
    );

    const result = await useCase.execute(experiment.id, exportId, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.stream).toBe(stream);
    expect(result.value.filename).toBe("leaf-photosynthesis-2026_raw-data_20260102_030405.csv");

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(exportsRepository.downloadExport).toHaveBeenCalledWith({
      experimentId: experiment.id,
      exportId,
    });
  });

  it("should treat offset-less Databricks timestamps as UTC", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Clean Data Run",
      userId: testUserId,
    });
    const exportId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      success({
        stream: mockStream(),
        filePath: `/volumes/exports/${exportId}/clean_data.xlsx`,
        tableName: "clean_data",
        completedAt: "2026-01-02 03:04:05",
      }),
    );

    const result = await useCase.execute(experiment.id, exportId, testUserId);

    assertSuccess(result);
    expect(result.value.filename).toBe("clean-data-run_clean-data_20260102_030405.xlsx");
  });

  it("should fall back to the export id when the completion time is missing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Fallback Experiment",
      userId: testUserId,
    });
    const exportId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      success({
        stream: mockStream(),
        filePath: "",
        tableName: "",
        completedAt: null,
      }),
    );

    const result = await useCase.execute(experiment.id, exportId, testUserId);

    assertSuccess(result);
    expect(result.value.filename).toBe(`fallback-experiment_${exportId}`);
  });

  it("should return not found when the experiment does not exist", async () => {
    const experimentId = faker.string.uuid();
    const exportId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport");

    const result = await useCase.execute(experimentId, exportId, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Experiment not found");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(exportsRepository.downloadExport).not.toHaveBeenCalled();
  });

  it("should propagate failure from downloadExport", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Propagate Not Found",
      userId: testUserId,
    });
    const exportId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      failure(AppError.notFound("Export not found")),
    );

    const result = await useCase.execute(experiment.id, exportId, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Export not found");
  });

  it("should propagate internal error from downloadExport", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Propagate Internal Error",
      userId: testUserId,
    });
    const exportId = faker.string.uuid();

    vi.spyOn(exportsRepository, "downloadExport").mockResolvedValue(
      failure(AppError.internal("Export file path is missing")),
    );

    const result = await useCase.execute(experiment.id, exportId, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Export file path is missing");
  });
});
