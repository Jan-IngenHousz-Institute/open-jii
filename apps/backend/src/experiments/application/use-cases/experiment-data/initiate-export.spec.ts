import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentDataExportsRepository } from "../../repositories/experiment-data-exports.repository";
import { InitiateExportUseCase } from "./initiate-export";

describe("InitiateExportUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: InitiateExportUseCase;
  let exportsRepository: ExperimentDataExportsRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(InitiateExportUseCase);
    exportsRepository = testApp.module.get(ExperimentDataExportsRepository);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully initiate an export", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Export_Experiment",
      userId: testUserId,
    });

    vi.spyOn(exportsRepository, "initiateExport").mockResolvedValue(success(undefined));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "csv",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.exportId).toBeDefined();
    expect(result.value.status).toBe("pending");

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(exportsRepository.initiateExport).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentId: experiment.id,
        tableName: "raw_data",
        format: "csv",
        userId: testUserId,
      }),
    );
  });

  it("should return not found when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, {
      tableName: "raw_data",
      format: "csv",
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
      format: "csv",
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

    vi.spyOn(exportsRepository, "initiateExport").mockResolvedValue(success(undefined));

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "raw_data",
      format: "json",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.exportId).toBeDefined();
    expect(result.value.status).toBe("pending");
  });

  it("should return internal error when initiateExport fails", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test_Experiment",
      userId: testUserId,
    });

    vi.spyOn(exportsRepository, "initiateExport").mockResolvedValue(
      failure(AppError.internal("Job trigger failed")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "raw_data",
      format: "csv",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Failed to initiate export");
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
      format: "csv",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toBe("Failed to verify experiment access");
  });
});
