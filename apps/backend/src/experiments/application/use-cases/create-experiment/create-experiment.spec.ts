import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { LocationRepository } from "../../../../experiments/core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "../../../../experiments/core/repositories/experiment-protocol.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../../../../test/test-harness";
import type { UserDto } from "../../../../users/core/models/user.model";
import { CreateExperimentUseCase } from "./create-experiment";

describe("CreateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentUseCase;
  let experimentMemberRepository: ExperimentMemberRepository;
  let experimentProtocolRepository: ExperimentProtocolRepository;
  let locationRepository: LocationRepository;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentUseCase);
    experimentMemberRepository = testApp.module.get(ExperimentMemberRepository);
    experimentProtocolRepository = testApp.module.get(ExperimentProtocolRepository);
    locationRepository = testApp.module.get(LocationRepository);
    protocolRepository = testApp.module.get(ProtocolRepository);

    // Mock the Databricks service
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create an experiment with valid data", async () => {
    const experimentData = {
      name: "Test Experiment",
      description: "A test experiment description",
      status: "active" as const,
      visibility: "private" as const,
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
      createdBy: testUserId,
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

  it("should create an experiment with protocols and locations", async () => {
    // 1. Create a protocol
    const protocolDto = {
      name: "Test Protocol",
      description: "Desc",
      code: [{}],
      duration: "1h",
      family: "multispeq" as const,
    };
    const protocolResult = await protocolRepository.create(protocolDto, testUserId);
    assertSuccess(protocolResult);
    const protocolId = protocolResult.value[0].id;

    const experimentData = {
      name: "Complex Experiment",
      protocols: [{ protocolId }],
      locations: [
        {
          name: "Loc 1",
          latitude: 10,
          longitude: 20,
          country: "TestCountry",
        },
      ],
    };

    const result = await useCase.execute(experimentData, testUserId);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Verify protocols
    const protocolsResult = await experimentProtocolRepository.listProtocols(createdExperiment.id);
    assertSuccess(protocolsResult);
    expect(protocolsResult.value).toHaveLength(1);
    expect(protocolsResult.value[0].protocol.id).toBe(protocolId);

    // Verify locations
    const locationsResult = await locationRepository.findByExperimentId(createdExperiment.id);
    assertSuccess(locationsResult);
    expect(locationsResult.value).toHaveLength(1);
    expect(locationsResult.value[0].name).toBe("Loc 1");
    // Latitude stored as string in DB usually, but repository might convert or not.
    // Looking at repository code: it inserts using .toString(), returns standard DTO.
    // If DTO has string, then it matches.
    expect(Number(locationsResult.value[0].latitude)).toBe(10);
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
  });

  it("should fail validation if protocols association fails", async () => {
    // Mock failure
    vi.spyOn(experimentProtocolRepository, "addProtocols").mockResolvedValue(
      failure(AppError.badRequest("Database error", "DATABASE_ERROR")),
    );

    const protocolDto = {
      name: "Test Protocol",
      description: "Desc",
      code: [{}],
      duration: "1h",
      family: "multispeq" as const,
    };
    const protocolResult = await protocolRepository.create(protocolDto, testUserId);
    assertSuccess(protocolResult);
    const protocolId = protocolResult.value[0].id;

    const experimentData = {
      name: "Bad Protocol Experiment",
      protocols: [{ protocolId }],
    };

    const result = await useCase.execute(experimentData, testUserId);
    assertFailure(result);
    // The use case acts as a "cleanup" or transactional boundary usually, but here it returns failure.
    // The logger logged EXPERIMENT_CREATE_FAILED.
    expect(result.error.message).toContain("Failed to associate protocols");
  });

  it("should fail validation if locations creation fails", async () => {
    // Mock failure
    vi.spyOn(locationRepository, "createMany").mockResolvedValue(
      failure(AppError.badRequest("Database error", "DATABASE_ERROR")),
    );

    const experimentData = {
      name: "Bad Location Experiment",
      locations: [
        {
          name: "Loc 1",
          latitude: 10,
          longitude: 20,
          country: "TestCountry",
        },
      ],
    };

    const result = await useCase.execute(experimentData, testUserId);
    assertFailure(result);
    expect(result.error.message).toContain("Failed to associate locations");
  });
});
