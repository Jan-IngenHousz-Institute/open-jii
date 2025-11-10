import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UpdateExperimentMemberRoleUseCase } from "./update-experiment-member-role";

describe("UpdateExperimentMemberRoleUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentMemberRoleUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentMemberRoleUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update a member's role", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Update Role Test Experiment",
      userId: testUserId,
    });

    // Add a regular member
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Update the member's role to admin
    const result = await useCase.execute(experiment.id, memberId, "admin", testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const updatedMember = result.value;
    expect(updatedMember.user.id).toBe(memberId);
    expect(updatedMember.role).toBe("admin");
    expect(updatedMember.experimentId).toBe(experiment.id);
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });

    const result = await useCase.execute(nonExistentId, memberId, "admin", testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Update Test Experiment",
      userId: testUserId,
    });

    // Create a non-admin user
    const nonAdminId = await testApp.createTestUser({
      email: "nonadmin@example.com",
    });
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Try to update member role as a non-admin user
    const result = await useCase.execute(experiment.id, memberId, "admin", nonAdminId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return FORBIDDEN when attempting to update member roles in an archived experiment", async () => {
    // Create an experiment and archive it
    const { experiment } = await testApp.createExperiment({
      name: "Archived Update Role Test",
      userId: testUserId,
      status: "archived",
    });

    // Add a regular member
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Attempt to update role as the creator/admin
    const result = await useCase.execute(experiment.id, memberId, "admin", testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return BAD_REQUEST when attempting to demote the last admin", async () => {
    // Create an experiment (creator is the only admin)
    const { experiment } = await testApp.createExperiment({
      name: "Last Admin Demotion Test",
      userId: testUserId,
    });

    // Attempt to demote self (the only admin) to member
    const result = await useCase.execute(experiment.id, testUserId, "member", testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("Cannot demote the last admin of the experiment");
  });

  it("should allow demoting an admin when there are multiple admins", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Multiple Admins Demotion Test",
      userId: testUserId,
    });

    // Add another admin
    const adminId = await testApp.createTestUser({
      email: "admin@example.com",
    });
    await testApp.addExperimentMember(experiment.id, adminId, "admin");

    // Now demote one admin to member (should succeed)
    const result = await useCase.execute(experiment.id, adminId, "member", testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.role).toBe("member");
  });

  it("should allow promoting a member to admin", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Member Promotion Test",
      userId: testUserId,
    });

    // Add a regular member
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Promote member to admin
    const result = await useCase.execute(experiment.id, memberId, "admin", testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.role).toBe("admin");
  });
});
