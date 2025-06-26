import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import { TestHarness } from "../../../../test/test-harness";
import type { UserDto } from "../../../../users/core/models/user.model";
import { CreateExperimentUseCase } from "./create-experiment";

describe("CreateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentUseCase;
  let experimentMemberRepository: ExperimentMemberRepository;
  let databricksService: DatabricksService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentUseCase);
    experimentMemberRepository = testApp.module.get(ExperimentMemberRepository);
    databricksService = testApp.module.get(DatabricksService);

    // Mock the Databricks service
    jest
      .spyOn(databricksService, "triggerJob")
      .mockResolvedValue(success({ run_id: 12345, number_in_job: 1 }));
  });

  afterEach(() => {
    testApp.afterEach();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create an experiment with valid data", async () => {
    const experimentData = {
      name: "Test Experiment",
      description: "A test experiment description",
      status: "provisioning" as const,
      visibility: "private" as const,
      embargoIntervalDays: 90,
    };

    const result = await useCase.execute(experimentData, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Verify all fields were set correctly
    expect(createdExperiment).toMatchObject({
      id: expect.any(String) as string,
      name: experimentData.name,
      description: experimentData.description,
      status: experimentData.status,
      visibility: experimentData.visibility,
      embargoIntervalDays: experimentData.embargoIntervalDays,
      createdBy: testUserId,
    });

    // Verify Databricks job was triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).toHaveBeenCalledWith({
      experimentId: createdExperiment.id,
      experimentName: experimentData.name,
      userId: testUserId,
    });
  });

  it("should add the creating user as an admin member", async () => {
    const experimentData = {
      name: "Member Test Experiment",
      description: "Testing automatic member creation",
    };

    const experimentResult = await useCase.execute(experimentData, testUserId);

    // Verify result is success
    expect(experimentResult.isSuccess()).toBe(true);
    assertSuccess(experimentResult);
    const createdExperiment = experimentResult.value;

    const membersResult = await experimentMemberRepository.getMembers(createdExperiment.id);

    expect(membersResult.isSuccess()).toBe(true);
    assertSuccess(membersResult);
    const members = membersResult.value;

    // Should have exactly 1 member (the creator)
    expect(members.length).toBe(1);

    // Verify the creator was added as an admin
    expect(members[0]).toMatchObject({
      experimentId: createdExperiment.id,
      role: "admin",
      user: expect.objectContaining({ id: testUserId }) as Partial<UserDto>,
    });
  });

  it("should create an experiment even if Databricks job trigger fails", async () => {
    // Mock Databricks job trigger failure
    jest.spyOn(databricksService, "triggerJob").mockResolvedValue(
      failure({
        name: "DatabricksError",
        code: "INTERNAL_ERROR",
        message: "Databricks API error",
        statusCode: 500,
      }),
    );

    const experimentData = {
      name: "Databricks Failure Test",
      description: "Testing continued creation when Databricks fails",
    };

    const result = await useCase.execute(experimentData, testUserId);

    // Verify experiment was still created successfully
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.name).toBe(experimentData.name);

    // Verify Databricks job was triggered but failed
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).toHaveBeenCalledWith({
      experimentId: result.value.id,
      experimentName: experimentData.name,
      userId: testUserId,
    });
  });

  it("should create an experiment with minimal data", async () => {
    // Only provide required name field
    const minimalData = {
      name: "Minimal Experiment",
    };

    const result = await useCase.execute(minimalData, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Verify experiment was created with defaults
    expect(createdExperiment).toMatchObject({
      id: expect.any(String) as string,
      name: minimalData.name,
      createdBy: testUserId,
    });

    // Verify Databricks job was triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).toHaveBeenCalledWith({
      experimentId: createdExperiment.id,
      experimentName: minimalData.name,
      userId: testUserId,
    });
  });

  it("should return error if name is not provided", async () => {
    const invalidData = {
      description: "Missing name field",
      name: "",
    };

    const result = await useCase.execute(invalidData, testUserId);

    // Verify error is returned
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("Experiment name is required");

    // Verify Databricks job was not triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).not.toHaveBeenCalled();
  });

  it("should return error if userId is not provided", async () => {
    const validData = {
      name: "Test Experiment",
    };

    // Pass empty userId
    const result = await useCase.execute(validData, "");

    // Verify error is returned
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User ID is required");

    // Verify Databricks job was not triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).not.toHaveBeenCalled();
  });

  it("should return error if experiment name already exists", async () => {
    // First create an experiment with a specific name
    const existingName = "Unique Experiment Name";
    await testApp.createExperiment({
      name: existingName,
      userId: testUserId,
    });

    // Now try to create another experiment with the same name
    const result = await useCase.execute({ name: existingName }, testUserId);

    // Verify error is returned
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain(
      `An experiment with the name "${existingName}" already exists`,
    );

    // Verify Databricks job was not triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).not.toHaveBeenCalled();
  });
});
