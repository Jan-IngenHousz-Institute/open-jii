import {
  and,
  ensurePersonalOrganization,
  eq,
  organizationMembers,
  organizations,
  resourceGrants,
} from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { LocationRepository } from "../../../../experiments/core/repositories/experiment-location.repository";
import { TestHarness } from "../../../../test/test-harness";
import { CreateExperimentUseCase } from "./create-experiment";

describe("CreateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateExperimentUseCase;
  let locationRepository: LocationRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateExperimentUseCase);
    locationRepository = testApp.module.get(LocationRepository);

    // Mock the Databricks service
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

  it("should assign the target organization to the experiment", async () => {
    const [targetOrganization] = await testApp.database
      .insert(organizations)
      .values({ name: "Target Experiment Organization", slug: `target-${testUserId}` })
      .returning();
    await testApp.database.insert(organizationMembers).values({
      organizationId: targetOrganization.id,
      userId: testUserId,
      role: "owner",
    });

    const result = await useCase.execute(
      { name: "Target Organization Experiment" },
      testUserId,
      targetOrganization.id,
    );

    assertSuccess(result);
    expect(result.value.organizationId).toBe(targetOrganization.id);
  });

  it("should fall back to the creator's personal organization when no target is provided", async () => {
    const result = await useCase.execute(
      { name: "Personal Organization Experiment" },
      testUserId,
      null,
    );
    const personalOrganizationId = await ensurePersonalOrganization(testApp.database, {
      id: testUserId,
    });

    assertSuccess(result);
    expect(result.value.organizationId).toBe(personalOrganizationId);
  });

  it("seeds the creator with an admin grant", async () => {
    const experimentData = {
      name: "Member Test Experiment",
      description: "Testing the creator's seeded access",
    };

    const experimentResult = await useCase.execute(experimentData, testUserId);

    assertSuccess(experimentResult);
    const createdExperiment = experimentResult.value;

    // The creator's access is an explicit direct admin grant. Without it the
    // experiment would start with no named steward and the staffing queries
    // would find nothing to protect.
    const grants = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, createdExperiment.id),
          eq(resourceGrants.granteeType, "user"),
        ),
      );
    expect(grants).toEqual([
      expect.objectContaining({
        granteeId: testUserId,
        role: "admin",
        createdBy: testUserId,
      }),
    ]);
  });

  it("gives each inline collaborator the contributing tier, and nothing more", async () => {
    const contributorId = await testApp.createTestUser({ email: "inline@example.com" });

    const experimentResult = await useCase.execute(
      { name: "Inline Collaborators Experiment", members: [{ userId: contributorId }] },
      testUserId,
    );
    assertSuccess(experimentResult);
    const createdExperiment = experimentResult.value;

    const grants = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, createdExperiment.id),
          eq(resourceGrants.granteeType, "user"),
        ),
      );
    // The creator administers; the person they listed contributes.
    expect(Object.fromEntries(grants.map((g) => [g.granteeId, g.role]))).toEqual({
      [testUserId]: "admin",
      [contributorId]: "member",
    });
  });

  it("should create an experiment with locations", async () => {
    const experimentData = {
      name: "Complex Experiment",
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

    // Verify locations
    const locationsResult = await locationRepository.findByExperimentId(createdExperiment.id);
    assertSuccess(locationsResult);
    expect(locationsResult.value).toHaveLength(1);
    expect(locationsResult.value[0].name).toBe("Loc 1");
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
