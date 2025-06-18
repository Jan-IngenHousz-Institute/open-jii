import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { UserDto } from "../../../../users/core/models/user.model";
import { ListExperimentMembersUseCase } from "./list-experiment-members";

describe("ListExperimentMembersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentMembersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentMembersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list members of an experiment", async () => {
    // Create an experiment
    const { experiment, experimentAdmin } = await testApp.createExperiment({
      name: "List Members Test Experiment",
      userId: testUserId,
    });

    // Add a member
    const memberId = await testApp.createTestUser({
      email: "member@example.com",
    });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // List members
    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);

    // Extract members from the success result
    const members = result._tag === "success" ? result.value : [];

    // Verify members are returned
    expect(members).toHaveLength(2); // Creator + added member

    // Verify members by role rather than hardcoded IDs
    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "admin",
          user: expect.objectContaining({
            id: experimentAdmin.userId,
          }) as Partial<UserDto>,
        }),
        expect.objectContaining({
          role: "member",
          user: expect.objectContaining({ id: memberId }) as Partial<UserDto>,
        }),
      ]),
    );
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user has no access to private experiment", async () => {
    // Create a private experiment
    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
      userId: testUserId,
    });

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser({
      email: "nonmember@example.com",
    });

    // Try to list members as non-member
    const result = await useCase.execute(experiment.id, nonMemberId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should allow any user to list members of a public experiment", async () => {
    // Create a public experiment
    const { experiment, experimentAdmin } = await testApp.createExperiment({
      name: "Public Experiment",
      visibility: "public",
      userId: testUserId,
    });

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser({
      email: "nonmember@example.com",
    });

    // List members as non-member
    const result = await useCase.execute(experiment.id, nonMemberId);

    expect(result.isSuccess()).toBe(true);

    // Extract members from the success result
    const members = result._tag === "success" ? result.value : [];

    // Verify members are returned
    expect(members).toHaveLength(1); // Just the creator
    expect(members[0]).toMatchObject({
      role: "admin",
      user: expect.objectContaining({
        id: experimentAdmin.userId,
      }) as Partial<UserDto>,
    });
  });
});
