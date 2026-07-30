import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { and, eq, resourceGrants } from "@repo/database";

import { assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { TransferResourceAdminUseCase } from "./transfer-resource-admin";

describe("TransferResourceAdminUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: TransferResourceAdminUseCase;

  /** The one answer every authorization negative gets, whatever its cause. */
  const NO_ACCESS_ERROR = "You have no access to transfer admin rights on this resource";

  /** A hand-off writes a grant — the surface that owns access tiers. */
  const directGrantRoleOf = async (
    resourceType: SharingResourceType,
    resourceId: string,
    userId: string,
  ) => {
    const rows = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceId),
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
    useCase = testApp.module.get(TransferResourceAdminUseCase);
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
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: collaboratorId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({
      resourceType: "experiment",
      resourceId: experiment.id,
      success: true,
    });
    expect(await directGrantRoleOf("experiment", experiment.id, collaboratorId)).toBe("admin");
  });

  it("grants admin to someone who had no access at all", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Add Outsider",
      userId: testUserId,
    });
    const outsiderId = await testApp.createTestUser({ email: "outsider@example.com" });

    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: outsiderId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf("experiment", experiment.id, outsiderId)).toBe("admin");
  });

  it("works on archived experiments (the controlled exception)", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Transfer",
      userId: testUserId,
      status: "archived",
    });
    const targetId = await testApp.createTestUser({ email: "archived-target@example.com" });

    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBe("admin");
  });

  // Every other shareable type blocks account deletion exactly as experiments do,
  // so the hand-off has to clear them too — otherwise a sole-admin macro would be a
  // blocker with no way out, and a device would dead-end the chain entirely (its
  // only other exit is deleting real AWS hardware).
  it.each([
    [
      "macro" as const,
      (userId: string) =>
        testApp.createMacro({ name: `Macro ${crypto.randomUUID()}`, createdBy: userId }),
    ],
    [
      "protocol" as const,
      (userId: string) =>
        testApp.createProtocol({ name: `Protocol ${crypto.randomUUID()}`, createdBy: userId }),
    ],
    [
      "workbook" as const,
      (userId: string) =>
        testApp.createWorkbook({ name: `Workbook ${crypto.randomUUID()}`, createdBy: userId }),
    ],
    [
      "device" as const,
      (userId: string) =>
        testApp.createIotDevice({ name: `Device ${crypto.randomUUID()}`, createdBy: userId }),
    ],
  ])("hands a %s over to another user", async (resourceType, create) => {
    const resource = await create(testUserId);
    const targetId = await testApp.createTestUser({ email: `${resourceType}@example.com` });

    const result = await useCase.execute(
      [{ resourceType, resourceId: resource.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({ resourceType, resourceId: resource.id, success: true });
    expect(await directGrantRoleOf(resourceType, resource.id, targetId)).toBe("admin");
  });

  it("fails a transfer when the caller cannot share the resource", async () => {
    const ownerId = await testApp.createTestUser({ email: "owner@example.com" });
    const { experiment } = await testApp.createExperiment({
      name: "Not My Experiment",
      userId: ownerId,
    });
    const targetId = await testApp.createTestUser({ email: "target@example.com" });

    // testUserId has no access to this experiment.
    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({
      resourceType: "experiment",
      resourceId: experiment.id,
      success: false,
      error: NO_ACCESS_ERROR,
    });
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBeNull();
  });

  it("fails a transfer on a resource that does not exist", async () => {
    const targetId = await testApp.createTestUser({ email: "nowhere@example.com" });
    const missingId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(
      [{ resourceType: "macro", resourceId: missingId, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0]).toEqual({
      resourceType: "macro",
      resourceId: missingId,
      success: false,
      error: NO_ACCESS_ERROR,
    });
  });

  it("answers a resource it cannot see exactly as one that does not exist", async () => {
    const ownerId = await testApp.createTestUser({ email: "oracle-owner@example.com" });
    const { experiment } = await testApp.createExperiment({
      name: "Existence Oracle",
      userId: ownerId,
    });
    const targetId = await testApp.createTestUser({ email: "oracle-target@example.com" });
    const missingId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(
      [
        { resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId },
        { resourceType: "experiment", resourceId: missingId, targetUserId: targetId },
      ],
      testUserId,
    );

    // Any authenticated caller can post an arbitrary uuid here, so a distinguishable
    // answer would confirm that the uuid names a real experiment — without a grant,
    // org membership or visibility on it.
    assertSuccess(result);
    const [inaccessible, missing] = result.value;
    expect(inaccessible.success).toBe(false);
    expect(missing.success).toBe(false);
    expect(inaccessible.error).toBe(missing.error);
  });

  it("fails a transfer to a non-existent user", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Bad Target",
      userId: testUserId,
    });

    const result = await useCase.execute(
      [
        {
          resourceType: "experiment",
          resourceId: experiment.id,
          targetUserId: "00000000-0000-0000-0000-000000000000",
        },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
  });

  it("refuses a target whose account has been closed", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Closed Target",
      userId: testUserId,
    });
    const closed = await testApp.createTestUser({ name: "Closed", deletedAt: new Date() });

    // Handing admin to a closed account would leave the experiment unstaffed again.
    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: closed }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(await directGrantRoleOf("experiment", experiment.id, closed)).toBeNull();
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
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: coAdminId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf("experiment", experiment.id, coAdminId)).toBe("admin");
  });

  it("processes several resources of different types independently", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Multi Experiment",
      userId: testUserId,
    });
    const macro = await testApp.createMacro({
      name: `Multi Macro ${crypto.randomUUID()}`,
      createdBy: testUserId,
    });
    const targetA = await testApp.createTestUser({ email: "a@example.com" });
    const targetB = await testApp.createTestUser({ email: "b@example.com" });

    const result = await useCase.execute(
      [
        { resourceType: "experiment", resourceId: experiment.id, targetUserId: targetA },
        { resourceType: "macro", resourceId: macro.id, targetUserId: targetB },
      ],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value.every((r) => r.success)).toBe(true);
    expect(await directGrantRoleOf("experiment", experiment.id, targetA)).toBe("admin");
    expect(await directGrantRoleOf("macro", macro.id, targetB)).toBe("admin");
  });
});
