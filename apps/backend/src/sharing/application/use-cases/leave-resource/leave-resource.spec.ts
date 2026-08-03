import { StatusCodes } from "http-status-codes";

import { and, eq, profiles, resourceGrants } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { LeaveResourceUseCase } from "./leave-resource";

/**
 * Self-leave: the caller's own direct grant is the authority, NOT `can(share)`.
 * The whole point is that a "Can view" grantee — who can never see the
 * collaborators list — can still remove themselves.
 */
describe("leaveResource", () => {
  const testApp = TestHarness.App;
  let leave: LeaveResourceUseCase;
  let authz: AuthorizationService;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    leave = testApp.module.get(LeaveResourceUseCase);
    authz = testApp.module.get(AuthorizationService);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function grantsFor(resourceType: "experiment" | "macro", resourceId: string, userId: string) {
    return testApp.database
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
  }

  it("lets a viewer grantee remove themselves from a private resource, dropping their access", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner, visibility: "private" });
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });

    // Sanity: a viewer cannot share, so revokeGrant would have refused them.
    expect(
      (await authz.can(viewer, { resourceType: "macro", resourceId: macro.id, action: "share" }))
        .allow,
    ).toBe(false);

    assertSuccess(await leave.execute(viewer, "macro", macro.id));

    expect(await grantsFor("macro", macro.id, viewer)).toHaveLength(0);
    // Private and no grant left: the resource is gone for them entirely.
    expect(
      (await authz.can(viewer, { resourceType: "macro", resourceId: macro.id, action: "read" }))
        .allow,
    ).toBe(false);
  });

  it("returns 404 for a caller with no direct grant (public reader), same as for a missing resource", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public
    const reader = await testApp.createTestUser({ name: "Reader" });

    const onPublic = await leave.execute(reader, "macro", macro.id);
    assertFailure(onPublic);
    expect(onPublic.error.statusCode).toBe(StatusCodes.NOT_FOUND);

    const onMissing = await leave.execute(reader, "macro", crypto.randomUUID());
    assertFailure(onMissing);
    // Indistinguishable from the public-resource case: no existence disclosure.
    expect(onMissing.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(onMissing.error.message).toBe(onPublic.error.message);
  });

  it("returns 404 for access held via an organization grant, leaving the org grant alone", async () => {
    const experiment = (
      await testApp.createExperiment({ name: `Exp ${crypto.randomUUID()}`, userId: owner })
    ).experiment;
    const orgId = await testApp.createOrganization();
    const member = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, member, "member");
    const orgGrant = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "organization",
      granteeId: orgId,
      role: "viewer",
    });

    // The org grant gives them read access — but no row of their own to leave.
    expect(
      (
        await authz.can(member, {
          resourceType: "experiment",
          resourceId: experiment.id,
          action: "read",
        })
      ).allow,
    ).toBe(true);

    const result = await leave.execute(member, "experiment", experiment.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);

    const stillThere = await testApp.database
      .select()
      .from(resourceGrants)
      .where(eq(resourceGrants.id, orgGrant.id));
    expect(stillThere).toHaveLength(1);
  });

  it.each(["experiment", "macro"] as const)(
    "gives an owner of a %s the uniform 404: they hold no grant to give up",
    async (resourceType) => {
      const resourceId =
        resourceType === "experiment"
          ? (
              await testApp.createExperiment({
                name: `Exp ${crypto.randomUUID()}`,
                userId: owner,
              })
            ).experiment.id
          : (await testApp.createMacro({ name: "M", createdBy: owner })).id;

      // Owning is not a grant, so there is nothing for leave to delete — and the
      // route must not disclose that by answering anything other than its uniform
      // 404. Leaving what you own is a matter of the organization, not the resource.
      const result = await leave.execute(owner, resourceType, resourceId);
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
    },
  );

  it("lets the only admin grantee leave while the owning org still has a living owner", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const keeper = await testApp.createTestUser({ name: "Keeper" });
    await testApp.addResourceAdmin("macro", macro.id, keeper);

    // The owner is answerable for the macro regardless, so the last admin *grant*
    // is not load-bearing and its holder may walk away.
    assertSuccess(await leave.execute(keeper, "macro", macro.id));
    expect(await grantsFor("macro", macro.id, keeper)).toHaveLength(0);
  });

  it("refuses the last admin's departure once the owner's account is closed", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const keeper = await testApp.createTestUser({ name: "Keeper" });
    await testApp.addResourceAdmin("macro", macro.id, keeper);
    // The husk case: no living owner, so the admin grant is the only thing left.
    await testApp.database
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.userId, owner));

    const result = await leave.execute(keeper, "macro", macro.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(result.error.message).toContain("macro");
    expect(await grantsFor("macro", macro.id, keeper)).toHaveLength(1);
  });

  it("lets a non-last admin leave an experiment", async () => {
    const experiment = (
      await testApp.createExperiment({ name: `Exp ${crypto.randomUUID()}`, userId: owner })
    ).experiment;
    const firstAdmin = await testApp.createTestUser({ name: "First Admin" });
    const secondAdmin = await testApp.createTestUser({ name: "Second Admin" });
    for (const granteeId of [firstAdmin, secondAdmin]) {
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId,
        role: "admin",
      });
    }

    assertSuccess(await leave.execute(secondAdmin, "experiment", experiment.id));
    expect(await grantsFor("experiment", experiment.id, secondAdmin)).toHaveLength(0);
    // The other admin's grant is untouched.
    expect(await grantsFor("experiment", experiment.id, firstAdmin)).toHaveLength(1);
  });

  // Leaving is a grant write like any other, so an archived experiment refuses it —
  // the disabled leave card is not the enforcement. The refusal must not become an
  // existence oracle either: this is the one grant route with no authorization check,
  // so a caller with nothing to leave still gets the uniform 404.
  describe("archived experiments", () => {
    it("refuses a grantee's departure and keeps their grant", async () => {
      const experiment = (
        await testApp.createExperiment({
          name: `Exp ${crypto.randomUUID()}`,
          userId: owner,
          status: "archived",
        })
      ).experiment;
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await testApp.addExperimentCollaborator(experiment.id, viewer);

      const result = await leave.execute(viewer, "experiment", experiment.id);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(result.error.message).toBe("Cannot modify an archived experiment");
      expect(await grantsFor("experiment", experiment.id, viewer)).toHaveLength(1);
    });

    it("still answers 404 to someone who holds no grant on it", async () => {
      const experiment = (
        await testApp.createExperiment({
          name: `Exp ${crypto.randomUUID()}`,
          userId: owner,
          status: "archived",
          visibility: "private",
        })
      ).experiment;
      const outsider = await testApp.createTestUser({ name: "Outsider" });

      const onArchived = await leave.execute(outsider, "experiment", experiment.id);
      const onMissing = await leave.execute(outsider, "experiment", crypto.randomUUID());

      // "It is archived" would be a fact about an experiment they cannot see.
      assertFailure(onArchived);
      assertFailure(onMissing);
      expect(onArchived.error.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(onArchived.error.message).toBe(onMissing.error.message);
    });
  });

  it("lets a viewer grantee leave an experiment (the regression case: self-removal without share)", async () => {
    const experiment = (
      await testApp.createExperiment({
        name: `Exp ${crypto.randomUUID()}`,
        userId: owner,
        visibility: "private",
      })
    ).experiment;
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addExperimentCollaborator(experiment.id, viewer);

    assertSuccess(await leave.execute(viewer, "experiment", experiment.id));
    expect(await grantsFor("experiment", experiment.id, viewer)).toHaveLength(0);
    expect(
      (
        await authz.can(viewer, {
          resourceType: "experiment",
          resourceId: experiment.id,
          action: "read",
        })
      ).allow,
    ).toBe(false);
  });
});
