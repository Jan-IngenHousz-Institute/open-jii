import { DatabricksService } from "../../../../common/services/databricks/databricks.service";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
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

    const membersResult = await experimentMemberRepository.getMembers(
      createdExperiment.id,
    );

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

    // Verify error is returned - database will reject empty/null name
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("REPOSITORY_ERROR");
    // Database constraint error message
    expect(result.error.message).toBeDefined();

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

    // Verify error is returned - database will reject invalid user reference
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("REPOSITORY_ERROR");
    // Database constraint error message
    expect(result.error.message).toBeDefined();

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

    // Verify error is returned - database unique constraint violation
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("REPOSITORY_DUPLICATE");
    // Database constraint error message
    expect(result.error.message).toBeDefined();

    // Verify Databricks job was not triggered
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(databricksService.triggerJob).not.toHaveBeenCalled();
  });

  it("should create an experiment with members", async () => {
    // Create test users to be added as members
    const member1Id = await testApp.createTestUser({
      email: "member1@example.com",
      name: "Member One",
    });
    const member2Id = await testApp.createTestUser({
      email: "member2@example.com",
      name: "Member Two",
    });

    const experimentData = {
      name: "Experiment with Members",
      description: "Testing experiment creation with members",
      members: [
        { userId: member1Id, role: "member" as const },
        { userId: member2Id, role: "admin" as const },
      ],
    };

    const result = await useCase.execute(experimentData, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Verify experiment was created
    expect(createdExperiment).toMatchObject({
      id: expect.any(String) as string,
      name: experimentData.name,
      description: experimentData.description,
      createdBy: testUserId,
    });

    // Verify members were added correctly
    const membersResult = await experimentMemberRepository.getMembers(
      createdExperiment.id,
    );

    expect(membersResult.isSuccess()).toBe(true);
    assertSuccess(membersResult);
    const members = membersResult.value;

    // Should have 3 members (creator + 2 added members)
    expect(members.length).toBe(3);

    // Find each member and verify their role
    const creatorMember = members.find((m) => m.user.id === testUserId);
    const member1 = members.find((m) => m.user.id === member1Id);
    const member2 = members.find((m) => m.user.id === member2Id);

    expect(creatorMember).toMatchObject({
      role: "admin",
      user: expect.objectContaining({ id: testUserId }) as Partial<UserDto>,
    });

    expect(member1).toMatchObject({
      role: "member",
      user: expect.objectContaining({ id: member1Id }) as Partial<UserDto>,
    });

    expect(member2).toMatchObject({
      role: "admin",
      user: expect.objectContaining({ id: member2Id }) as Partial<UserDto>,
    });
  });

  it("should filter out creator from members list if included", async () => {
    const member1Id = await testApp.createTestUser({
      email: "member@example.com",
      name: "Member",
    });

    const experimentData = {
      name: "Experiment with Creator in Members",
      description: "Testing that creator is not duplicated",
      members: [
        { userId: member1Id, role: "member" as const },
        { userId: testUserId, role: "member" as const }, // This should be filtered out
      ],
    };

    const result = await useCase.execute(experimentData, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Verify members
    const membersResult = await experimentMemberRepository.getMembers(
      createdExperiment.id,
    );

    expect(membersResult.isSuccess()).toBe(true);
    assertSuccess(membersResult);
    const members = membersResult.value;

    // Should have 2 members (creator as admin + 1 added member)
    expect(members.length).toBe(2);

    // Creator should still be admin, not member
    const creatorMember = members.find((m) => m.user.id === testUserId);
    expect(creatorMember?.role).toBe("admin");

    // Other member should be added as member
    const otherMember = members.find((m) => m.user.id === member1Id);
    expect(otherMember?.role).toBe("member");
  });
});
