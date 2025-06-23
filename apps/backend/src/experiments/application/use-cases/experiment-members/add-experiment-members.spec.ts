import {
  assertFailure,
  assertSuccess,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AddExperimentMembersUseCase } from "./add-experiment-members";

describe("AddExperimentMembersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddExperimentMembersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddExperimentMembersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add multiple members to an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Add Members Test Experiment",
      userId: testUserId,
    });

    // Create new users to add as members
    const member1Id = await testApp.createTestUser({
      email: "member1@example.com",
    });
    const member2Id = await testApp.createTestUser({
      email: "member2@example.com",
    });

    // Add the members through the use case
    const result = await useCase.execute(
      experiment.id,
      [
        { userId: member1Id, role: "member" },
        { userId: member2Id, role: "admin" },
      ],
      testUserId,
    );

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const members = result.value;
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBe(2);

    const memberIds = members.map((m) => m.user.id);
    expect(memberIds).toContain(member1Id);
    expect(memberIds).toContain(member2Id);

    const member1 = members.find((m) => m.user.id === member1Id);
    const member2 = members.find((m) => m.user.id === member2Id);

    expect(member1?.role).toBe("member");
    expect(member2?.role).toBe("admin");
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const memberId = await testApp.createTestUser({
      email: "nonexistent-batch@example.com",
    });

    const result = await useCase.execute(
      nonExistentId,
      [{ userId: memberId, role: "member" }],
      testUserId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Batch Test Experiment",
      userId: testUserId,
    });

    // Create a non-admin user
    const nonAdminId = await testApp.createTestUser({
      email: "nonadmin-batch@example.com",
    });
    const memberId = await testApp.createTestUser({
      email: "member-batch@example.com",
    });

    // Try to add members as a non-admin user
    const result = await useCase.execute(
      experiment.id,
      [{ userId: memberId, role: "member" }],
      nonAdminId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should handle repository failure when adding members", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Repository Failure Test",
      userId: testUserId,
    });

    // Create a member to add
    const memberId = await testApp.createTestUser({
      email: "repo-failure@example.com",
    });

    // Mock the repository to return a failure result
    const repositoryAddMembersSpy = jest
      .spyOn(useCase["experimentMemberRepository"], "addMembers")
      .mockResolvedValueOnce({
        isSuccess: () => false,
        isFailure: () => true,
        _tag: "failure",
        error: { message: "Database error" },
      } as any);

    try {
      const result = await useCase.execute(
        experiment.id,
        [{ userId: memberId, role: "member" }],
        testUserId,
      );

      expect(result.isSuccess()).toBe(false);
      expect(result._tag).toBe("failure");

      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("Failed to add experiment members");
    } finally {
      // Restore original method
      repositoryAddMembersSpy.mockRestore();
    }
  });
});
