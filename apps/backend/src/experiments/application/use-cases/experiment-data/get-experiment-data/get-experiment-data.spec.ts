import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { ExperimentDataRepository } from "../../../../core/repositories/experiment-data.repository";
import { ExperimentRepository } from "../../../../core/repositories/experiment.repository";
import { GetExperimentDataUseCase } from "./get-experiment-data";

describe("GetExperimentDataUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentDataUseCase;
  let experimentDataRepository: ExperimentDataRepository;
  let experimentRepository: ExperimentRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentDataUseCase);
    experimentDataRepository = testApp.module.get(ExperimentDataRepository);
    experimentRepository = testApp.module.get(ExperimentRepository);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return table data when tableName is specified", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    const mockTableData = {
      name: "bronze_data",
      displayName: "Raw Data",
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      data: {
        columns: [
          { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 0 },
          { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 },
        ],
        rows: [
          { timestamp: "2023-01-01T12:00:00Z", temperature: "25.5" },
          { timestamp: "2023-01-01T12:01:00Z", temperature: "26.0" },
        ],
        totalRows: 2,
        truncated: false,
      },
      page: 1,
      pageSize: 5,
      totalPages: 1,
      totalRows: 2,
    };

    vi.spyOn(experimentDataRepository, "getTableData").mockResolvedValue(success([mockTableData]));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      page: 1,
      pageSize: 5,
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([mockTableData]);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(experimentDataRepository.getTableData).toHaveBeenCalledWith({
      experimentId: experiment.id,
      experiment: expect.objectContaining({ id: experiment.id }) as typeof experiment,
      tableName: "bronze_data",
      columns: undefined,
      orderBy: undefined,
      orderDirection: "ASC",
      page: 1,
      pageSize: 5,
    });
  });

  it("should return specific columns when columns parameter is provided", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const mockTableData = {
      name: "bronze_data",
      displayName: "Raw Data",
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      data: {
        columns: [
          { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 0 },
          { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE", position: 1 },
        ],
        rows: [{ timestamp: "2023-01-01T12:00:00Z", temperature: "25.5" }],
        totalRows: 1,
        truncated: false,
      },
      page: 1,
      pageSize: 5,
      totalPages: 1,
      totalRows: 1,
    };

    vi.spyOn(experimentDataRepository, "getTableData").mockResolvedValue(success([mockTableData]));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      columns: "timestamp,temperature",
      page: 1,
      pageSize: 5,
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(experimentDataRepository.getTableData).toHaveBeenCalledWith({
      experimentId: experiment.id,
      experiment: expect.objectContaining({ id: experiment.id }) as typeof experiment,
      tableName: "bronze_data",
      columns: ["timestamp", "temperature"],
      orderBy: undefined,
      orderDirection: "ASC",
      page: 1,
      pageSize: 5,
    });
  });

  it("should handle ordering when orderBy and orderDirection are specified", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const mockTableData = {
      name: "bronze_data",
      displayName: "Raw Data",
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      data: {
        columns: [
          { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP", position: 0 },
        ],
        rows: [{ timestamp: "2023-01-01T12:02:00Z" }, { timestamp: "2023-01-01T12:01:00Z" }],
        totalRows: 2,
        truncated: false,
      },
      page: 1,
      pageSize: 5,
      totalPages: 1,
      totalRows: 2,
    };

    vi.spyOn(experimentDataRepository, "getTableData").mockResolvedValue(success([mockTableData]));

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
      orderBy: "timestamp",
      orderDirection: "DESC",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(experimentDataRepository.getTableData).toHaveBeenCalledWith({
      experimentId: experiment.id,
      experiment: expect.objectContaining({ id: experiment.id }) as typeof experiment,
      tableName: "bronze_data",
      columns: undefined,
      orderBy: "timestamp",
      orderDirection: "DESC",
      page: 1,
      pageSize: 5,
    });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId, testUserId, {
      tableName: "bronze_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(nonExistentId);
  });

  it("should return forbidden error when user does not have access to private experiment", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "bronze_data",
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("do not have access");
  });

  it("should allow access to public experiment even if user is not a member", async () => {
    const anotherUserId = await testApp.createTestUser({
      email: "another@example.com",
    });

    const { experiment } = await testApp.createExperiment({
      name: "Public Experiment",
      visibility: "public",
      userId: testUserId,
    });

    const mockTableData = {
      name: "bronze_data",
      displayName: "Raw Data",
      catalog_name: "test_catalog",
      schema_name: "test_schema",
      data: {
        columns: [{ name: "id", type_name: "LONG", type_text: "BIGINT", position: 0 }],
        rows: [{ id: "1" }],
        totalRows: 1,
        truncated: false,
      },
      page: 1,
      pageSize: 5,
      totalPages: 1,
      totalRows: 1,
    };

    vi.spyOn(experimentDataRepository, "getTableData").mockResolvedValue(success([mockTableData]));

    const result = await useCase.execute(experiment.id, anotherUserId, {
      tableName: "bronze_data",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
  });

  it("should return bad request error when tableName is not provided", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const result = await useCase.execute(experiment.id, testUserId, {} as { tableName: string });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("tableName parameter is required");
  });

  it("should handle repository getTableData failure", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    vi.spyOn(experimentDataRepository, "getTableData").mockResolvedValue(
      failure(AppError.internal("Failed to fetch table data")),
    );

    const result = await useCase.execute(experiment.id, testUserId, {
      tableName: "bronze_data",
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
    });

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
