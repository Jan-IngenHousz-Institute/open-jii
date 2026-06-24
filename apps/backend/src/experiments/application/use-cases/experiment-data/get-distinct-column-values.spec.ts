import { faker } from "@faker-js/faker";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentDataRepository } from "../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { GetDistinctColumnValuesUseCase } from "./get-distinct-column-values";

describe("GetDistinctColumnValuesUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetDistinctColumnValuesUseCase;
  let experimentDataRepository: ExperimentDataRepository;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetDistinctColumnValuesUseCase);
    experimentDataRepository = testApp.module.get(ExperimentDataRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return distinct values for a column", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const mockResponse = {
      values: ["alpha", "beta", "gamma"],
      truncated: false,
    };

    const repoSpy = vi
      .spyOn(experimentDataRepository, "getDistinctColumnValues")
      .mockResolvedValue(success(mockResponse));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      column: "category",
      limit: 100,
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual(mockResponse);
    expect(repoSpy).toHaveBeenCalledWith({
      experimentId: experiment.id,
      experiment: expect.objectContaining({ id: experiment.id }),
      tableName: "bronze_data",
      column: "category",
      limit: 100,
    });
  });

  it("should apply default limit when not specified", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const repoSpy = vi
      .spyOn(experimentDataRepository, "getDistinctColumnValues")
      .mockResolvedValue(success({ values: [], truncated: false }));

    await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    // Default cap from DISTINCT_VALUES_DEFAULT_LIMIT.
    expect(repoSpy).toHaveBeenCalledWith({
      experimentId: experiment.id,
      experiment: expect.objectContaining({ id: experiment.id }),
      tableName: "bronze_data",
      column: "category",
      limit: 200,
    });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(nonExistentId);
  });

  it("should return forbidden error when user does not have access to private experiment", async () => {
    const anotherUserId = await testApp.createTestUser({ email: "another@example.com" });

    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("do not have access");
  });

  it("should allow access to a public experiment even if user is not a member", async () => {
    const anotherUserId = await testApp.createTestUser({ email: "another@example.com" });

    const { experiment } = await testApp.createExperiment({
      name: "Public Experiment",
      visibility: "public",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getDistinctColumnValues").mockResolvedValue(
      success({ values: ["x"], truncated: false }),
    );

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.values).toEqual(["x"]);
  });

  it("should propagate repository failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getDistinctColumnValues").mockResolvedValue(
      failure(AppError.internal("Failed to fetch distinct values")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should handle checkAccess failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      failure(AppError.internal("Database connection failed")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      column: "category",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
