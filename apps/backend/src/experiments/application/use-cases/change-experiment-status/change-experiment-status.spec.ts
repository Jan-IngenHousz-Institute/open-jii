import {
  assertFailure,
  assertSuccess,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ChangeExperimentStatusUseCase } from "./change-experiment-status";

describe("ChangeExperimentStatusUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ChangeExperimentStatusUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ChangeExperimentStatusUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should change experiment status successfully", async () => {
    // Create an experiment with initial status 'provisioning'
    const { experiment } = await testApp.createExperiment({
      name: "Status Change Test",
      status: "provisioning",
      userId: testUserId,
    });

    // Change the status to 'active'
    const result = await useCase.execute(experiment.id, "active", testUserId);

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const updatedExperiment = result.value;
    expect(updatedExperiment).not.toBeNull();

    // Verify the status was updated
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      status: "active",
    });
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to update a non-existent experiment
    const result = await useCase.execute(nonExistentId, "active", testUserId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    // Use the assertion function for cleaner tests
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return BAD_REQUEST error for invalid status", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Invalid Status Test",
      userId: testUserId,
    });

    const result = await useCase.execute(
      experiment.id,
      // @ts-expect-error - Testing invalid status
      "invalid_status",
      testUserId,
    );

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    // Use the assertion function for cleaner tests
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("should support all valid status transitions", async () => {
    // Create an experiment with initial status 'provisioning'
    const { experiment } = await testApp.createExperiment({
      name: "All Status Transitions Test",
      status: "provisioning",
      userId: testUserId,
    });

    // Change to active
    let result = await useCase.execute(experiment.id, "active", testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    let updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("active");

    // Change to archived
    result = await useCase.execute(experiment.id, "archived", testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("archived");

    // Change back to active
    result = await useCase.execute(experiment.id, "active", testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("active");

    // Change back to provisioning
    result = await useCase.execute(experiment.id, "provisioning", testUserId);
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("provisioning");
  });

  it("should return FORBIDDEN error when user is not admin", async () => {
    // Create an experiment with the test user as owner
    const { experiment } = await testApp.createExperiment({
      name: "Admin Only Test",
      userId: testUserId,
    });

    // Create another user who is not an admin
    const nonAdminUserId = await testApp.createTestUser({});

    // Try to change status as non-admin user
    const result = await useCase.execute(
      experiment.id,
      "active",
      nonAdminUserId,
    );

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toBe(
      "Only admins can change experiment status",
    );
  });

  it("should return INTERNAL_ERROR when repository update fails", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Update Failure Test",
      userId: testUserId,
    });

    // Create a spy on the use case's repository dependency
    const repositoryUpdateSpy = jest
      .spyOn(useCase["experimentRepository"], "update")
      .mockResolvedValueOnce({
        isSuccess: () => true,
        chain: (fn: any) => fn([]), // Return empty array to simulate failure
      } as any);

    try {
      const result = await useCase.execute(experiment.id, "active", testUserId);

      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe(
        `Failed to update status for experiment ${experiment.id}`,
      );
    } finally {
      // Restore original method
      repositoryUpdateSpy.mockRestore();
    }
  });
});
