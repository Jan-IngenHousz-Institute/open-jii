import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { EmailPort } from "../../../core/ports/email.port";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { AddExperimentMembersUseCase } from "./add-experiment-members";

describe("AddExperimentMembersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddExperimentMembersUseCase;
  let emailPort: EmailPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddExperimentMembersUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
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

    // Mock email sending
    emailPort = testApp.module.get(EMAIL_PORT);
    vi.spyOn(emailPort, "sendAddedUserNotification").mockResolvedValue(success(undefined));

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

  it("should return FORBIDDEN when attempting to add members to an archived experiment", async () => {
    // Create an experiment and archive it
    const { experiment } = await testApp.createExperiment({
      name: "Archived Add Members Test",
      userId: testUserId,
      status: "archived",
    });

    // Create a user to add
    const memberId = await testApp.createTestUser({ email: "archived-add-member@example.com" });

    // Attempt to add as the creator/admin
    const result = await useCase.execute(
      experiment.id,
      [{ userId: memberId, role: "member" }],
      testUserId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
