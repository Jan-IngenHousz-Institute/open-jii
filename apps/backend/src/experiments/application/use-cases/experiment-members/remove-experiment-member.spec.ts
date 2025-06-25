import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { RemoveExperimentMemberUseCase } from "./remove-experiment-member";

describe("RemoveExperimentMemberUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveExperimentMemberUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    // Create a fresh test user for each test
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveExperimentMemberUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should allow admin to remove a member", async () => {
    // Create an experiment (creator is automatically an admin)
    const { experiment } = await testApp.createExperiment({
      name: "Remove Member Test Experiment",
      userId: testUserId,
    });

    // Add a regular member
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Remove the member as admin (using the creator's ID)
    const result = await useCase.execute(experiment.id, memberId, testUserId);

    // Verify success
    expect(result.isSuccess()).toBe(true);
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const memberId = await testApp.createTestUser({
      email: "nonexistent@example.com",
    });

    const result = await useCase.execute(nonExistentId, memberId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create the admin user and experiment
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Test Experiment",
      userId: testUserId,
    });

    // Create a regular user who is not an admin
    const regularUserId = await testApp.createTestUser({
      email: "regular@example.com",
    });

    // Add a member to remove
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Try to remove a member as a non-admin user
    const result = await useCase.execute(experiment.id, memberId, regularUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND error if member does not exist", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Member Not Found Test",
      userId: testUserId,
    });

    // Try to remove a non-existent member
    const nonExistentMemberId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(experiment.id, nonExistentMemberId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("not found in this experiment");
  });
});
