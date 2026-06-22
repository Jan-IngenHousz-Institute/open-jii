import { and, eq, experimentMembers } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { TransferExperimentAdminUseCase } from "./transfer-experiment-admin";

describe("TransferExperimentAdminUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: TransferExperimentAdminUseCase;

  const roleOf = async (experimentId: string, userId: string) => {
    const rows = await testApp.database
      .select()
      .from(experimentMembers)
      .where(
        and(eq(experimentMembers.experimentId, experimentId), eq(experimentMembers.userId, userId)),
      );
    return rows.length > 0 ? rows[0].role : null;
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(TransferExperimentAdminUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("promotes an existing member to admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Promote Member",
      userId: testUserId,
    });
    const memberId = await testApp.createTestUser({ email: "member@example.com" });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: memberId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({ experimentId: experiment.id, success: true });
    expect(await roleOf(experiment.id, memberId)).toBe("admin");
  });

  it("adds a non-member as an admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Add Non-member",
      userId: testUserId,
    });
    const outsiderId = await testApp.createTestUser({ email: "outsider@example.com" });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: outsiderId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await roleOf(experiment.id, outsiderId)).toBe("admin");
  });

  it("works on archived experiments (the controlled exception)", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Transfer",
      userId: testUserId,
      status: "archived",
    });
    const memberId = await testApp.createTestUser({ email: "archived-member@example.com" });
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: memberId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await roleOf(experiment.id, memberId)).toBe("admin");
  });

  it("fails a transfer when the caller is not an admin of the experiment", async () => {
    const ownerId = await testApp.createTestUser({ email: "owner@example.com" });
    const { experiment } = await testApp.createExperiment({
      name: "Not My Experiment",
      userId: ownerId,
    });
    const targetId = await testApp.createTestUser({ email: "target@example.com" });
    await testApp.addExperimentMember(experiment.id, targetId, "member");

    // testUserId is not a member/admin of this experiment.
    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(await roleOf(experiment.id, targetId)).toBe("member");
  });

  it("fails a transfer to a non-existent user", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Bad Target",
      userId: testUserId,
    });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: "00000000-0000-0000-0000-000000000000" }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
  });

  it("is a no-op when the target is already an admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Already Admin",
      userId: testUserId,
    });
    const coAdminId = await testApp.createTestUser({ email: "co-admin@example.com" });
    await testApp.addExperimentMember(experiment.id, coAdminId, "admin");

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: coAdminId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await roleOf(experiment.id, coAdminId)).toBe("admin");
  });

  it("processes multiple experiments independently", async () => {
    const { experiment: expA } = await testApp.createExperiment({
      name: "Multi A",
      userId: testUserId,
    });
    const { experiment: expB } = await testApp.createExperiment({
      name: "Multi B",
      userId: testUserId,
    });
    const memberA = await testApp.createTestUser({ email: "a@example.com" });
    const memberB = await testApp.createTestUser({ email: "b@example.com" });
    await testApp.addExperimentMember(expA.id, memberA, "member");

    const result = await useCase.execute(
      [
        { experimentId: expA.id, targetUserId: memberA },
        { experimentId: expB.id, targetUserId: memberB },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value.every((r) => r.success)).toBe(true);
    expect(await roleOf(expA.id, memberA)).toBe("admin");
    expect(await roleOf(expB.id, memberB)).toBe("admin");
  });
});
