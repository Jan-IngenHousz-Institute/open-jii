
import { TestHarness } from "../../../../test/test-harness";
import { assertFailure } from "../../../utils/fp-utils";
import { AddExperimentMemberUseCase } from "./add-experiment-member";

describe("AddExperimentMemberUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddExperimentMemberUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(AddExperimentMemberUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add a member to an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Add Member Test Experiment",
      userId: testUserId,
    });

    // Create a new user to add as a member
    const newMemberId = await testApp.createTestUser({
      email: "newmember@example.com",
    });

    testApp.addExperimentMember(experiment.id, newMemberId, "member");

    // Add the member
    const result = await useCase.execute(
      experiment.id,
      { userId: newMemberId, role: "member" },
      testUserId,
    );

    // Verify result is success
    expect(result.isSuccess()).toBe(true);

    // Extract member from the success result
    const member = result._tag === "success" ? result.value : null;
    expect(member).not.toBeNull();

    // Verify the member was added
    expect(member.experimentId).toBe(experiment.id);
    expect(member.userId).toBe(newMemberId);
    expect(member.role).toBe("member");
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const newMemberId = await testApp.createTestUser({
      email: "nonexistent@example.com",
    });

    const result = await useCase.execute(
      nonExistentId,
      { userId: newMemberId },
      testUserId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Test Experiment",
      userId: testUserId,
    });

    // Create a non-admin user
    const nonAdminId = await testApp.createTestUser({
      email: "nonadmin@example.com",
    });
    const newMemberId = await testApp.createTestUser({
      email: "newmember2@example.com",
    });

    // Try to add a member as a non-admin user
    const result = await useCase.execute(
      experiment.id,
      { userId: newMemberId },
      nonAdminId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
