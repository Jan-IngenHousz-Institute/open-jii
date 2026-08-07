import { StatusCodes } from "http-status-codes";

import {
  and,
  createSecondaryDatabase,
  eq,
  organizationMembers,
  organizations,
  resourceGrants,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import type { CachePort } from "../../../../macros/core/ports/cache.port";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import { SharingRepository } from "../../../core/repositories/sharing.repository";
import { lockStaffedResource } from "../../../core/resource-staffing";
import { CreateGrantUseCase } from "./create-grant";

describe("createGrant", () => {
  const testApp = TestHarness.App;
  let createGrant: CreateGrantUseCase;
  let sharingRepo: SharingRepository;
  let owner: string;
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };

  // Deleting a macro is all these tests use the repository for, so only the
  // invalidation hook that path calls needs a stand-in.
  const cache = {
    invalidate: () => Promise.resolve(),
  } as unknown as CachePort;

  beforeAll(async () => {
    await testApp.setup();
    secondary = createSecondaryDatabase();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    createGrant = testApp.module.get(CreateGrantUseCase);
    sharingRepo = testApp.module.get(SharingRepository);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  /** Pause after the picker-equivalent check, before the write transaction starts. */
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

  const directGrantCount = async (resourceId: string, granteeId: string) => {
    const rows = await testApp.database
      .select({ id: resourceGrants.id })
      .from(resourceGrants)
      .where(
        and(eq(resourceGrants.resourceId, resourceId), eq(resourceGrants.granteeId, granteeId)),
      );
    return rows.length;
  };

  it("returns 400 when the grantee does not exist", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const result = await createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: crypto.randomUUID(),
      role: "viewer",
    });
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("fails not-found when the resource is deleted after authorization", async () => {
    const macro = await testApp.createMacro({ name: "Deleted Mid-share", createdBy: owner });
    const grantee = await testApp.createTestUser({ name: "Late Grantee" });
    const { checkFinished, release, spy } = pauseAfterSelectabilityCheck();

    const creating = createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    await checkFinished;
    assertSuccess(await new MacroRepository(secondary.database, cache).delete(macro.id));
    release();

    const result = await creating;
    spy.mockRestore();
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(result.error.message).toBe("Resource not found");
    expect(await directGrantCount(macro.id, grantee)).toBe(0);
  });

  it("refuses a grantee whose account closes after selectability", async () => {
    const macro = await testApp.createMacro({ name: "Closed Mid-share", createdBy: owner });
    const grantee = await testApp.createTestUser({ name: "Closing Grantee" });
    const { checkFinished, release, spy } = pauseAfterSelectabilityCheck();

    const creating = createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });
    await checkFinished;
    assertSuccess(await new UserRepository(secondary.database).delete(grantee));
    release();

    const result = await creating;
    spy.mockRestore();
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(await directGrantCount(macro.id, grantee)).toBe(0);
  });

  it("refuses an organization deleted after selectability", async () => {
    const macro = await testApp.createMacro({ name: "Org Deleted Mid-share", createdBy: owner });
    const grantee = await testApp.createOrganization("Closing Organization");
    await testApp.addOrganizationMember(grantee, owner, "member");
    const { checkFinished, release, spy } = pauseAfterSelectabilityCheck();

    const creating = createGrant.execute(owner, "macro", macro.id, {
      granteeType: "organization",
      granteeId: grantee,
      role: "viewer",
    });
    await checkFinished;
    await secondary.database.transaction(async (tx) => {
      await tx.delete(organizationMembers).where(eq(organizationMembers.organizationId, grantee));
      await tx.delete(organizations).where(eq(organizations.id, grantee));
    });
    release();

    const result = await creating;
    spy.mockRestore();
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(await directGrantCount(macro.id, grantee)).toBe(0);
  });

  it("makes resource deletion wait for an in-flight grant, then sweeps that grant", async () => {
    const macro = await testApp.createMacro({ name: "Share Wins Lock", createdBy: owner });
    const grantee = await testApp.createTestUser({ name: "Swept Grantee" });
    const blocker = createSecondaryDatabase();
    try {
      const deleter = new MacroRepository(secondary.database, cache);
      const [{ pid }] = await secondary.database.execute<{ pid: number }>(
        sql`SELECT pg_backend_pid() AS pid`,
      );
      let locked!: () => void;
      let write!: () => void;
      const resourceLocked = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const writeGrant = new Promise<void>((resolve) => {
        write = resolve;
      });
      const holding = blocker.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "macro", macro.id);
        locked();
        await writeGrant;
        await tx.insert(resourceGrants).values({
          resourceType: "macro",
          resourceId: macro.id,
          granteeType: "user",
          granteeId: grantee,
          role: "viewer",
          createdBy: owner,
        });
      });
      await resourceLocked;

      const deleting = deleter.delete(macro.id);
      for (let attempt = 0; attempt < 100; attempt++) {
        const [{ waiting }] = await testApp.database.execute<{ waiting: number }>(sql`
          SELECT count(*)::int AS waiting
          FROM pg_stat_activity
          WHERE pid = ${Number(pid)} AND wait_event_type = 'Lock'
        `);
        if (Number(waiting) > 0) break;
        if (attempt === 99) throw new Error("resource deletion never waited on the share lock");
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      write();
      await holding;
      assertSuccess(await deleting);
      expect(await directGrantCount(macro.id, grantee)).toBe(0);
    } finally {
      await blocker.close();
    }
  });

  it("re-sharing an existing grantee updates the role (upsert, single direct row)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const outsider = await testApp.createTestUser({ name: "Outsider" });

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
      }),
    );
    const second = await createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: outsider,
      role: "admin",
    });
    assertSuccess(second);
    // One row for the grantee, not two — beside the creator's own grant.
    const granteeRows = second.value.filter(
      (row): row is Extract<typeof row, { kind: "grant" }> =>
        row.kind === "grant" && row.granteeId === outsider,
    );
    expect(granteeRows).toHaveLength(1);
    expect(granteeRows[0].role).toBe("admin");
    expect(granteeRows[0].isOutsideCollaborator).toBe(true);
  });

  // Grantees are validated against the same visibility rules the grantee
  // pickers use — existence alone is not enough, because the collaborators list
  // would then disclose that grantee's details back to the sharer.
  describe("grantee selectability", () => {
    it("rejects a deactivated user (not discoverable in the people picker)", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const deactivated = await testApp.createTestUser({ name: "Gone User", activated: false });

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: deactivated,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects a soft-deleted user", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const deleted = await testApp.createTestUser({ name: "Deleted User", deletedAt: new Date() });

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: deleted,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects an organization the sharer is not a member of", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const strangerOrg = await testApp.createOrganization("Someone Else Lab");

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: strangerOrg,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects a personal workspace as an organization grantee", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      // The owner's own personal org: they are a member, but personal
      // workspaces are excluded from the picker.
      const personalOrgId = await testApp.personalOrganizationId(owner);

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: personalOrgId,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("accepts an organization the sharer belongs to", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const orgId = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(orgId, owner, "member");

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: orgId,
        role: "viewer",
      });
      assertSuccess(result);
      expect(result.value.map((g) => g.granteeId)).toContain(orgId);
    });
  });

  it("denies a viewer-grant holder from sharing", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });
    const other = await testApp.createTestUser({ name: "Other" });

    const result = await createGrant.execute(viewer, "macro", macro.id, {
      granteeType: "user",
      granteeId: other,
      role: "viewer",
    });
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  // An archived experiment is immutable everywhere else — the disabled invite button
  // is not the enforcement, the server is.
  it("refuses a new grant on an archived experiment, writing nothing", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
      status: "archived",
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });

    const result = await createGrant.execute(owner, "experiment", experiment.id, {
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
    });

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toBe("Cannot modify an archived experiment");
    expect(
      await testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeId, collaborator),
          ),
        ),
    ).toEqual([]);
  });
});
