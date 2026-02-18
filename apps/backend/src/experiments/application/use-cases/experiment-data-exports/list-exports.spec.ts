import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExportMetadata } from "../../../core/models/experiment-data-exports.model";
import { ExperimentDataExportsRepository } from "../../../core/repositories/experiment-data-exports.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
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

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully list exports with active and completed", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_List_Exports",
      userId: testUserId,
    });

    const mockExports: ExportMetadata[] = [
      {
        exportId: null,
        experimentId: experiment.id,
        tableName: "raw_data",
        format: "csv",
        status: "running",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: testUserId,
        createdAt: "2026-01-02T00:00:00Z",
        completedAt: null,
        jobRunId: 222,
      },
      {
        exportId: faker.string.uuid(),
        experimentId: experiment.id,
        tableName: "raw_data",
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 1000,
        fileSize: 50000,
        createdBy: testUserId,
        createdAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-01-01T00:05:00Z",
        jobRunId: 111,
      },
    ];

    vi.spyOn(exportsRepository, "listExports").mockResolvedValue(success(mockExports));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.exports).toHaveLength(2);
    expect(result.value.exports[0].status).toBe("running");
    expect(result.value.exports[1].status).toBe("completed");

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(exportsRepository.listExports).toHaveBeenCalledWith({
      experimentId: experiment.id,
      tableName: "raw_data",
    });
  });

  it("should return empty exports list when no exports exist", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Empty_Exports",
      userId: testUserId,
    });

    vi.spyOn(exportsRepository, "listExports").mockResolvedValue(success([]));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.exports).toHaveLength(0);
  });

  it("should return not found when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, {
      tableName: "raw_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("Experiment not found");
  });

  it("should return forbidden when user does not have access to private experiment", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Private_Experiment",
      visibility: "private",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "raw_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("Access denied");
  });

  it("should allow access to public experiments without membership", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "public-user@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Public_Experiment",
      visibility: "public",
      userId: testUserId,
    });

    vi.spyOn(exportsRepository, "listExports").mockResolvedValue(success([]));

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "raw_data",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
  });

  it("should return internal error when listExports fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment",
      userId: testUserId,
    });

    vi.spyOn(exportsRepository, "listExports").mockResolvedValue(
      failure(AppError.internal("Failed to query exports")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to list exports");
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
      tableName: "raw_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toBe("Failed to verify experiment access");
  });
});
