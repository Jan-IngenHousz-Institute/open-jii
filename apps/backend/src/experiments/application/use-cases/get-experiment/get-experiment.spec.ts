import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentUseCase } from "./get-experiment";

describe("GetExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentUseCase;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentUseCase);
    databricksService = testApp.module.get(DatabricksService);

    // Mock the Databricks service to return successful analytics data
    jest.spyOn(databricksService, "getExperimentData").mockResolvedValue(
      success({
        columns: [
          { name: "id", type_name: "STRING", type_text: "STRING" },
          { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [
          ["exp-123", "123.45"],
          ["exp-123", "67.89"],
        ],
        totalRows: 2,
        truncated: false,
      }),
    );
  });

  afterEach(() => {
    testApp.afterEach();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return an experiment with analytics when found", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      embargoIntervalDays: 90,
      userId: testUserId,
    });

    // Act
    const result = await useCase.execute(experiment.id);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const retrievedExperiment = result.value;
    expect(retrievedExperiment).not.toBeNull();

    // Verify experiment properties
    expect(retrievedExperiment).toMatchObject({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      visibility: experiment.visibility,
      embargoIntervalDays: experiment.embargoIntervalDays,
      createdBy: testUserId,
    });

    // Verify analytics data was included
    expect(retrievedExperiment.analytics).toBeDefined();
    expect(retrievedExperiment.analytics).toEqual({
      columns: [
        { name: "id", type_name: "STRING", type_text: "STRING" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        ["exp-123", "123.45"],
        ["exp-123", "67.89"],
      ],
      totalRows: 2,
      truncated: false,
    });

    // Verify Databricks service was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentData).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
    );
  });

  it("should return experiment without analytics when Databricks fails", async () => {
    // Mock Databricks service to fail
    jest.spyOn(databricksService, "getExperimentData").mockResolvedValue(
      failure({
        name: "DatabricksError",
        code: "INTERNAL_ERROR",
        message: "Failed to fetch analytics data",
        statusCode: 500,
      }),
    );

    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      userId: testUserId,
    });

    // Act
    const result = await useCase.execute(experiment.id);

    // Assert result is success (experiment should still be returned)
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const retrievedExperiment = result.value;

    // Verify experiment properties
    expect(retrievedExperiment).toMatchObject({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      createdBy: testUserId,
    });

    // Verify analytics data is undefined when Databricks fails
    expect(retrievedExperiment.analytics).toBeUndefined();

    // Verify Databricks service was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentData).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
    );
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(
      `Experiment with ID ${nonExistentId} not found`,
    );

    // Verify Databricks service was not called since experiment wasn't found
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentData).not.toHaveBeenCalled();
  });

  it("should include analytics with empty data when Databricks returns no results", async () => {
    // Mock Databricks service to return empty results
    jest.spyOn(databricksService, "getExperimentData").mockResolvedValue(
      success({
        columns: [
          { name: "id", type_name: "STRING", type_text: "STRING" },
          { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
        rows: [],
        totalRows: 0,
        truncated: false,
      }),
    );

    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Empty Analytics Experiment",
      userId: testUserId,
    });

    // Act
    const result = await useCase.execute(experiment.id);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const retrievedExperiment = result.value;

    // Verify experiment properties
    expect(retrievedExperiment).toMatchObject({
      id: experiment.id,
      name: experiment.name,
      createdBy: testUserId,
    });

    // Verify analytics data is included but empty
    expect(retrievedExperiment.analytics).toBeDefined();
    expect(retrievedExperiment.analytics?.rows).toEqual([]);
    expect(retrievedExperiment.analytics?.totalRows).toBe(0);

    // Verify Databricks service was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentData).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
    );
  });
});
