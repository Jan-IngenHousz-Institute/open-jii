import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { and, createSecondaryDatabase, eq, resourceGrants } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import { SharingRepository } from "../../../core/repositories/sharing.repository";
import { TransferResourceAdminUseCase } from "./transfer-resource-admin";

describe("TransferResourceAdminUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: TransferResourceAdminUseCase;
  let sharingRepo: SharingRepository;
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };

  /** The one answer every authorization negative gets, whatever its cause. */
  const NO_ACCESS_ERROR = "You have no access to transfer admin rights on this resource";

  /**
   * The answer when the caller may share the resource but is not the last person
   * answerable for it, so this archived-exempt hand-off is not theirs to use.
   */
  const NOT_SOLE_ADMIN_ERROR =
    "Admin can only be handed over this way while you are the resource's only admin";

  /**
   * Read the caller's blocker list through the same predicate the hand-off proves,
   * so a test that relies on the caller being blocked says so instead of assuming it.
   */
  const isDeletionBlocker = async (
    resourceType: SharingResourceType,
    resourceId: string,
    userId: string,
  ) => {
    const blockers = await testApp.module.get(UserRepository).findSoleAdminResources(userId);
    assertSuccess(blockers);
    return blockers.value.some((b) => b.resourceType === resourceType && b.id === resourceId);
  };

  const expectIsDeletionBlocker = async (
    resourceType: SharingResourceType,
    resourceId: string,
    userId: string,
  ) => expect(await isDeletionBlocker(resourceType, resourceId, userId)).toBe(true);

  const expectIsNotDeletionBlocker = async (
    resourceType: SharingResourceType,
    resourceId: string,
    userId: string,
  ) => expect(await isDeletionBlocker(resourceType, resourceId, userId)).toBe(false);

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
    secondary = createSecondaryDatabase();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(TransferResourceAdminUseCase);
    sharingRepo = testApp.module.get(SharingRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  /** Pause after the target passed the picker-equivalent pre-flight check. */
  const pauseAfterSelectabilityCheck = () => {
    let checked!: () => void;
    let release!: () => void;
    const checkFinished = new Promise<void>((resolve) => {
      checked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Bound before the spy replaces the method, so the mock can still reach the
    // real implementation without recursing back through itself.
    const original = sharingRepo.granteeIsSelectable.bind(
      sharingRepo,
    ) as SharingRepository["granteeIsSelectable"];
    const spy = vi
      .spyOn(sharingRepo, "granteeIsSelectable")
      .mockImplementationOnce(async (...args) => {
        const selectable = await original(...args);
        checked();
        await released;
        return selectable;
      });
    return { checkFinished, release, spy };
  };

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
      role: "viewer",
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

  it("works on archived experiments for a caller it actually blocks (the controlled exception)", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Transfer",
      userId: testUserId,
      status: "archived",
    });
    const targetId = await testApp.createTestUser({ email: "archived-target@example.com" });

    // The exception exists for exactly this state, so state it: without a hand-off
    // this experiment is a deletion blocker the caller cannot clear any other way,
    // because archived resources refuse ordinary grant writes.
    await expectIsDeletionBlocker("experiment", experiment.id, testUserId);

    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(true);
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBe("admin");
  });

  it("refuses an archived experiment the caller is not actually blocked by", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived But Staffed",
      userId: testUserId,
      status: "archived",
    });
    // A second administrable admin means the caller is answerable for nothing here:
    // the resource never appears among their deletion blockers, so the
    // archived-exempt write has nothing to earn it.
    const coAdminId = await testApp.createTestUser({ email: "archived-co-admin@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: coAdminId,
      role: "admin",
    });
    const targetId = await testApp.createTestUser({ email: "archived-outsider@example.com" });

    await expectIsNotDeletionBlocker("experiment", experiment.id, testUserId);

    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(result.value[0].error).toBe(NOT_SOLE_ADMIN_ERROR);
    // The refusal must leave nothing behind — on an archived experiment a stray
    // grant could never be revoked.
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBeNull();
  });

  it("refuses a hand-off by an owner who is not the resource's only admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Already Staffed",
      userId: testUserId,
    });
    const coAdminId = await testApp.createTestUser({ email: "staffed-co-admin@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: coAdminId,
      role: "admin",
    });
    const targetId = await testApp.createTestUser({ email: "staffed-target@example.com" });

    // The caller still holds `share` — this is refused on the deletion-blocker
    // proof, not on authorization.
    const result = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );

    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(result.value[0].error).toBe(NOT_SOLE_ADMIN_ERROR);
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBeNull();
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

  it("refuses a target whose account closes after selectability", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Closing Target",
      userId: testUserId,
    });
    const target = await testApp.createTestUser({ name: "Closing during transfer" });
    const { checkFinished, release, spy } = pauseAfterSelectabilityCheck();

    const transferring = useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: target }],
      testUserId,
    );
    await checkFinished;
    assertSuccess(await new UserRepository(secondary.database).delete(target));
    release();

    const result = await transferring;
    spy.mockRestore();
    assertSuccess(result);
    expect(result.value[0].success).toBe(false);
    expect(await directGrantRoleOf("experiment", experiment.id, target)).toBeNull();
  });

  it("leaves the handed-over grant intact when the same hand-off is replayed", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Replayed Hand-off",
      userId: testUserId,
    });
    const targetId = await testApp.createTestUser({ email: "co-admin@example.com" });

    const first = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );
    assertSuccess(first);
    expect(first.value[0].success).toBe(true);

    // The first hand-off is what cleared the blocker, so the second has nothing left
    // to clear and is refused. What matters is that the replay is harmless: the grant
    // it already wrote is untouched, not lowered or removed.
    const replay = await useCase.execute(
      [{ resourceType: "experiment", resourceId: experiment.id, targetUserId: targetId }],
      testUserId,
    );
    assertSuccess(replay);
    expect(replay.value[0].success).toBe(false);
    expect(replay.value[0].error).toBe(NOT_SOLE_ADMIN_ERROR);
    expect(await directGrantRoleOf("experiment", experiment.id, targetId)).toBe("admin");
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
