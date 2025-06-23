import { eq, experiments } from "@repo/database";

import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DeleteExperimentUseCase } from "./delete-experiment";

describe("DeleteExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment for Deletion",
      userId: testUserId,
    });

    // Delete the experiment
    const result = await useCase.execute(experiment.id, testUserId);

    // Verify the operation was successful
    expect(result.isSuccess()).toBe(true);

    // Verify the experiment is gone by attempting to find it
    const experimentCheck = await testApp.database
      .select()
      .from(experiments)
      .where(eq(experiments.id, experiment.id))
      .limit(1);

    expect(experimentCheck.length).toBe(0);
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to delete a non-existent experiment
    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error when user is not admin", async () => {
    // Create an experiment with the test user as owner
    const { experiment } = await testApp.createExperiment({
      name: "Admin Only Delete Test",
      userId: testUserId,
    });

    // Create another user who is not an admin
    const nonAdminUserId = await testApp.createTestUser({});

    // Try to delete as non-admin user
    const result = await useCase.execute(experiment.id, nonAdminUserId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("Only admins can delete experiments");
  });

  it("should handle repository deletion failure", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Delete Failure Test",
      userId: testUserId,
    });

    // Mock the repository to return a failure result
    const repositoryDeleteSpy = jest
      .spyOn(useCase["experimentRepository"], "delete")
      .mockResolvedValueOnce({
        isSuccess: () => false,
        isFailure: () => true,
        _tag: "failure",
        error: { message: "Database error" },
      } as any);

    try {
      const result = await useCase.execute(experiment.id, testUserId);

      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");
    } finally {
      // Restore original method
      repositoryDeleteSpy.mockRestore();
    }
  });
});
