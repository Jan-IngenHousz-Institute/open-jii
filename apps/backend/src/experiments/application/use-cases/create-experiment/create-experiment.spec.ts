import { eq, experimentMembers } from "@repo/database";

import { ExperimentMemberRepository } from "../../../../experiments/core/repositories/experiment-member.repository";
import { TestHarness } from "../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../utils/fp-utils";
import { CreateExperimentUseCase } from "./create-experiment";

describe("CreateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
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
      id: expect.any(String),
      name: experimentData.name,
      description: experimentData.description,
      status: experimentData.status,
      visibility: experimentData.visibility,
      embargoIntervalDays: experimentData.embargoIntervalDays,
      createdBy: testUserId,
    });
  });
  it("should add the creating user as an admin member", async () => {
    const experimentData = {
      name: "Member Test Experiment",
      description: "Testing automatic member creation",
    };

    const result = await useCase.execute(experimentData, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdExperiment = result.value;

    // Get the experiment member repository directly from the module
    const experimentMemberRepository = testApp.module.get(
      ExperimentMemberRepository,
    );

    // Query for members using direct database access since we don't have typed access to repository
    const members = await testApp.database
      .select()
      .from(experimentMembers)
      .where(eq(experimentMembers.experimentId, createdExperiment.id));

    // Should have exactly 1 member (the creator)
    expect(members.length).toBe(1);

    // Verify the creator was added as an admin
    expect(members[0]).toMatchObject({
      experimentId: createdExperiment.id,
      userId: testUserId,
      role: "admin",
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
      id: expect.any(String),
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
  });
});
