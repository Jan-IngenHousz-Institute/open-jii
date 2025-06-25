import {
  assertFailure,
  assertSuccess,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UpdateExperimentUseCase } from "./update-experiment";

describe("UpdateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update an experiment with valid data", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Original Experiment Name",
      description: "Original description",
      status: "provisioning",
      visibility: "private",
      userId: testUserId,
    });

    // Define update data
    const updateData = {
      name: "Updated Experiment Name",
      description: "Updated description",
      status: "active" as const,
      visibility: "public" as const,
      embargoIntervalDays: 120,
    };

    // Execute the update
    const result = await useCase.execute(experiment.id, updateData, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedExperiment = result.value;

    // Verify all fields were updated correctly
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      name: updateData.name,
      description: updateData.description,
      status: updateData.status,
      visibility: updateData.visibility,
      embargoIntervalDays: updateData.embargoIntervalDays,
      createdBy: testUserId,
    });
  });

  it("should update only specified fields", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Original Name",
      description: "Original description",
      status: "provisioning",
      visibility: "private",
      userId: testUserId,
    });

    // Update only the name field
    const partialUpdate = {
      name: "Updated Name Only",
    };

    const result = await useCase.execute(
      experiment.id,
      partialUpdate,
      testUserId,
    );

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedExperiment = result.value;

    // Verify only the name was updated but other fields remain the same
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      name: partialUpdate.name,
      description: experiment.description,
      status: experiment.status,
      visibility: experiment.visibility,
      createdBy: testUserId,
    });
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = { name: "Won't Update" };

    const result = await useCase.execute(nonExistentId, updateData, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(
      `Experiment with ID ${nonExistentId} not found`,
    );
  });

  it("should return FORBIDDEN error when user is not admin", async () => {
    // Create an experiment with the test user as owner
    const { experiment } = await testApp.createExperiment({
      name: "Admin Only Update Test",
      userId: testUserId,
    });

    // Create another user who is not an admin
    const nonAdminUserId = await testApp.createTestUser({});

    // Try to update as non-admin user
    const updateData = { name: "Unauthorized Update" };
    const result = await useCase.execute(
      experiment.id,
      updateData,
      nonAdminUserId,
    );

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("Only admins can update experiments");
  });

  it("should return INTERNAL_ERROR when repository update fails", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Update Failure Test",
      userId: testUserId,
    });

    // Mock the repository to return empty array (simulating update failure)
    const repositoryUpdateSpy = jest
      .spyOn(useCase["experimentRepository"], "update")
      .mockResolvedValueOnce({
        isSuccess: () => true,
        chain: (fn: any) => fn([]), // Return empty array to simulate failure
      } as any);

    try {
      const updateData = { name: "Failed Update" };
      const result = await useCase.execute(
        experiment.id,
        updateData,
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe(
        `Failed to update experiment ${experiment.id}`,
      );
    } finally {
      // Restore original method
      repositoryUpdateSpy.mockRestore();
    }
  });
});
