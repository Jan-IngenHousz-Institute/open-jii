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

  it("should return FORBIDDEN error if user is not a member", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Access Control Test",
      userId: testUserId,
    });

    // Create another user who is not a member
    const otherUserId = await testApp.createTestUser({});

    // Try to delete as non-member
    const result = await useCase.execute(experiment.id, otherUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe("Only experiment members can delete experiments");
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to delete a non-existent experiment
    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
