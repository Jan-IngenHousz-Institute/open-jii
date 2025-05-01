import { experiments } from "@repo/database";
import { eq } from "drizzle-orm";

import { TestHarness } from "../../../../test/test-harness";
import { assertFailure } from "../../../utils/fp-utils";
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
    const result = await useCase.execute(experiment.id);

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
    const result = await useCase.execute(nonExistentId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
