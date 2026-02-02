import { beforeEach, afterEach, beforeAll, afterAll, describe, it, expect, vi } from "vitest";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataRepository } from "../../repositories/experiment-data.repository";
import { DownloadExperimentDataUseCase } from "./download-experiment-data";

describe("DownloadExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DownloadExperimentDataUseCase;
  let experimentDataRepository: ExperimentDataRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(DownloadExperimentDataUseCase);
    experimentDataRepository = testApp.module.get(ExperimentDataRepository);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully prepare download links for table data", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Download_Test_Experiment",
      description: "Test Download Description",
      status: "active",
      visibility: "private",
      embargoUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userId: testUserId,
    });

    // Mock the download data response
    const mockDownloadData = {
      externalLinks: [
        {
          externalLink: "https://databricks-presigned-url.com/chunk0",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 50000,
          rowCount: 1000,
        },
        {
          externalLink: "https://databricks-presigned-url.com/chunk1",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 25000,
          rowCount: 500,
        },
      ],
      totalRows: 1500,
    };

    vi.spyOn(experimentDataRepository, "getTableDataForDownload").mockResolvedValue(
      success(mockDownloadData),
    );

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
    });

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const downloadData = result.value;

    expect(downloadData).toEqual({
      externalLinks: [
        {
          externalLink: "https://databricks-presigned-url.com/chunk0",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 50000,
          rowCount: 1000,
        },
        {
          externalLink: "https://databricks-presigned-url.com/chunk1",
          expiration: "2024-01-01T15:00:00.000Z",
          totalSize: 25000,
          rowCount: 500,
        },
      ],
    });

    // Verify repository call
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(experimentDataRepository.getTableDataForDownload).toHaveBeenCalledWith({
      experimentId: experiment.id,
      tableName: "bronze_data",
    });
  });

  it("should return error when table does not exist", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment_NoTable",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getTableDataForDownload").mockResolvedValue(
      failure(AppError.notFound("Table 'nonexistent_table' not found in this experiment")),
    );

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "nonexistent_table",
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toContain("Failed to prepare data download");
  });

  it("should return error when user doesn't have access to experiment", async () => {
    // Create another user
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    // Create an experiment with the first user
    const { experiment } = await testApp.createExperiment({
      name: "Private_Experiment",
      visibility: "private",
      userId: testUserId,
    });

    // Try to download with the second user (no access)
    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "some_table",
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Access denied to this experiment");
  });

  it("should return error when getTableDataForDownload fails", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test_Download_Failure",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getTableDataForDownload").mockResolvedValue(
      failure(AppError.internal("Database connection failed")),
    );

    // Act
    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "test_table",
    });

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toContain("Failed to prepare data download");
  });

  it("should handle checkAccess failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment",
      userId: testUserId,
    });

    const experimentRepository = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      failure(AppError.internal("Database connection failed")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "test_table",
    });

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toBe("Failed to verify experiment access");
  });
});
