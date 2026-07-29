import { and, eq, resourceGrants } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { TransferExperimentAdminUseCase } from "./transfer-experiment-admin";

describe("TransferExperimentAdminUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: TransferExperimentAdminUseCase;

  /** A hand-off writes a grant — the surface that owns access tiers. */
  const directGrantRoleOf = async (experimentId: string, userId: string) => {
    const rows = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "experiment"),
          eq(resourceGrants.resourceId, experimentId),
          eq(resourceGrants.granteeType, "user"),
          eq(resourceGrants.granteeId, userId),
        ),
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

  it("promotes an existing collaborator to a direct admin grant", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Promote Collaborator",
      userId: testUserId,
    });
    const collaboratorId = await testApp.createTestUser({ email: "collaborator@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: collaboratorId,
      role: "member",
    });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: collaboratorId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({ experimentId: experiment.id, success: true });
    expect(await directGrantRoleOf(experiment.id, collaboratorId)).toBe("admin");
  });

  it("grants admin to someone who had no access at all", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Add Outsider",
      userId: testUserId,
    });
    const outsiderId = await testApp.createTestUser({ email: "outsider@example.com" });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: outsiderId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf(experiment.id, outsiderId)).toBe("admin");
  });

  it("works on archived experiments (the controlled exception)", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Transfer",
      userId: testUserId,
      status: "archived",
    });
    const targetId = await testApp.createTestUser({ email: "archived-target@example.com" });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf(experiment.id, targetId)).toBe("admin");
  });

  it("fails a transfer when the caller is not an admin of the experiment", async () => {
    const ownerId = await testApp.createTestUser({ email: "owner@example.com" });
    const { experiment } = await testApp.createExperiment({
      name: "Not My Experiment",
      userId: ownerId,
    });
    const targetId = await testApp.createTestUser({ email: "target@example.com" });

    // testUserId has no access to this experiment.
    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(await directGrantRoleOf(experiment.id, targetId)).toBeNull();
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
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: coAdminId,
      role: "admin",
    });

    const result = await useCase.execute(
      [{ experimentId: experiment.id, targetUserId: coAdminId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf(experiment.id, coAdminId)).toBe("admin");
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
    const targetA = await testApp.createTestUser({ email: "a@example.com" });
    const targetB = await testApp.createTestUser({ email: "b@example.com" });

    const result = await useCase.execute(
      [
        { experimentId: expA.id, targetUserId: targetA },
        { experimentId: expB.id, targetUserId: targetB },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value.every((r) => r.success)).toBe(true);
    expect(await directGrantRoleOf(expA.id, targetA)).toBe("admin");
    expect(await directGrantRoleOf(expB.id, targetB)).toBe("admin");
  });
});
