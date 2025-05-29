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

    // Mock the Databricks service to return successful data
    jest.spyOn(databricksService, "getExperimentSchemaData").mockResolvedValue(
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

  it("should return an experiment with data when found", async () => {
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

    // Verify data was included
    expect(retrievedExperiment.data).toBeDefined();
    expect(retrievedExperiment.data).toEqual({
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
    expect(databricksService.getExperimentSchemaData).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
    );
  });

  it("should return experiment without data when Databricks fails", async () => {
    // Mock Databricks service to fail
    jest.spyOn(databricksService, "getExperimentSchemaData").mockResolvedValue(
      failure({
        name: "DatabricksError",
        code: "INTERNAL_ERROR",
        message: "Failed to fetch data",
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

    // Verify data is undefined when Databricks fails
    expect(retrievedExperiment.data).toBeUndefined();

    // Verify Databricks service was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentSchemaData).toHaveBeenCalledWith(
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
    expect(databricksService.getExperimentSchemaData).not.toHaveBeenCalled();
  });

  it("should include data with empty results when Databricks returns no results", async () => {
    // Mock Databricks service to return empty results
    jest.spyOn(databricksService, "getExperimentSchemaData").mockResolvedValue(
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
      name: "Empty Data Experiment",
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

    // Verify data is included but empty
    expect(retrievedExperiment.data).toBeDefined();
    expect(retrievedExperiment.data?.rows).toEqual([]);
    expect(retrievedExperiment.data?.totalRows).toBe(0);

    // Verify Databricks service was called
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.getExperimentSchemaData).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
    );
  });
});
