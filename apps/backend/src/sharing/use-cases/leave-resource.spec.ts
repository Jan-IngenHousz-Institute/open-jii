import { StatusCodes } from "http-status-codes";

import { and, eq, resourceGrants } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { assertFailure, assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
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

  it("refuses the last admin's departure from an experiment (staffing invariant)", async () => {
    const experiment = (
      await testApp.createExperiment({ name: `Exp ${crypto.randomUUID()}`, userId: owner })
    ).experiment;

    // The creator holds the only admin grant.
    const result = await leave.execute(owner, "experiment", experiment.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(await grantsFor("experiment", experiment.id, owner)).toHaveLength(1);
  });

  it("lets a non-last admin leave an experiment", async () => {
    const experiment = (
      await testApp.createExperiment({ name: `Exp ${crypto.randomUUID()}`, userId: owner })
    ).experiment;
    const secondAdmin = await testApp.createTestUser({ name: "Second Admin" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: secondAdmin,
      role: "admin",
    });

    assertSuccess(await leave.execute(secondAdmin, "experiment", experiment.id));
    expect(await grantsFor("experiment", experiment.id, secondAdmin)).toHaveLength(0);
    // The creator's admin grant is untouched.
    expect(await grantsFor("experiment", experiment.id, owner)).toHaveLength(1);
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
