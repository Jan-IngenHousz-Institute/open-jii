import { StatusCodes } from "http-status-codes";

import { and, eq, macros, profiles, resourceGrants } from "@repo/database";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { SharingRepository } from "../../../core/repositories/sharing.repository";
import { TransferResourceOrgUseCase } from "./transfer-resource-org";

/**
 * Moving a resource between organizations. The gate is the whole point: full
 * control of the resource is not enough, because grant tiers carry `manage` and
 * revoking a grant is `share`-gated — so a "Can edit" collaborator allowed to
 * transfer could walk off with somebody else's work and lock them out of it.
 * Authority over the organization losing the resource is what has to be proven,
 * and the one case with nobody to take it from is the one that relaxes it.
 */
describe("TransferResourceOrgUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: TransferResourceOrgUseCase;
  let authz: AuthorizationService;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(TransferResourceOrgUseCase);
    authz = testApp.module.get(AuthorizationService);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** An organization plus a macro it owns. */
  async function labWithMacro(ownerRole: "owner" | "admin" = "owner") {
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, owner, ownerRole);
    const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId });
    return { organizationId, macro };
  }

  const owningOrgOf = async (macroId: string) => {
    const [row] = await testApp.database
      .select({ organizationId: macros.organizationId })
      .from(macros)
      .where(eq(macros.id, macroId));
    return row.organizationId;
  };

  const grantsOn = (macroId: string, granteeType: "user" | "organization" | "team") =>
    testApp.database
      .select({ granteeId: resourceGrants.granteeId, role: resourceGrants.role })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "macro"),
          eq(resourceGrants.resourceId, macroId),
          eq(resourceGrants.granteeType, granteeType),
        ),
      );

  /** Close the only account that owns an organization, leaving it a husk. */
  const closeAccount = (userId: string) =>
    testApp.database
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.userId, userId));

  it("moves a macro from an organization the caller owns into their workspace", async () => {
    const { organizationId, macro } = await labWithMacro();
    const personal = await testApp.personalOrganizationId(owner);

    const result = await useCase.execute(owner, "macro", macro.id, personal);

    assertSuccess(result);
    expect(result.value).toEqual({
      resourceType: "macro",
      resourceId: macro.id,
      organizationId: personal,
    });
    expect(await owningOrgOf(macro.id)).toBe(personal);
    // The organization it left keeps nothing: the whole point of the move is that
    // the delete block on the old organization is now clear.
    expect(await owningOrgOf(macro.id)).not.toBe(organizationId);
  });

  it("lets an admin of the owning organization transfer too", async () => {
    const { organizationId, macro } = await labWithMacro("admin");
    // Somebody has to own it, or this would be the husk case instead.
    const livingOwner = await testApp.createTestUser({ name: "Boss" });
    await testApp.addOrganizationMember(organizationId, livingOwner, "owner");
    const personal = await testApp.personalOrganizationId(owner);

    assertSuccess(await useCase.execute(owner, "macro", macro.id, personal));
    expect(await owningOrgOf(macro.id)).toBe(personal);
  });

  it("refuses a Can-edit grantee while the owning organization has a living owner", async () => {
    const { organizationId, macro } = await labWithMacro();
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "admin",
    });
    const personal = await testApp.personalOrganizationId(collaborator);

    // They can manage the macro — publish it, even delete it — but taking it out
    // of the organization is not theirs to do.
    expect(
      (
        await authz.can(collaborator, {
          resourceType: "macro",
          resourceId: macro.id,
          action: "manage",
        })
      ).allow,
    ).toBe(true);

    const result = await useCase.execute(collaborator, "macro", macro.id, personal);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(await owningOrgOf(macro.id)).toBe(organizationId);
  });

  it("lets that same grantee rescue the macro once the organization has no living owner", async () => {
    const { macro } = await labWithMacro();
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "admin",
    });
    const personal = await testApp.personalOrganizationId(collaborator);
    // Nobody is left to move it, and the organization can never be deleted while
    // it still owns something — this is the only way out.
    await closeAccount(owner);

    assertSuccess(await useCase.execute(collaborator, "macro", macro.id, personal));
    expect(await owningOrgOf(macro.id)).toBe(personal);
  });

  it("refuses the grantee while the organization still has a living admin", async () => {
    const { organizationId, macro } = await labWithMacro();
    // Losing the owner does not make an organization abandoned. Carol still runs
    // it, and the resource is hers to keep.
    const admin = await testApp.createTestUser({ name: "Carol" });
    await testApp.addOrganizationMember(organizationId, admin, "admin");
    const collaborator = await testApp.createTestUser({ name: "Bob" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "admin",
    });
    const personal = await testApp.personalOrganizationId(collaborator);
    await closeAccount(owner);

    const result = await useCase.execute(collaborator, "macro", macro.id, personal);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(await owningOrgOf(macro.id)).toBe(organizationId);
    // The capability rides the same predicate, so the UI must not offer it either.
    expect(await authz.canTransferOut(collaborator, organizationId)).toBe(false);
  });

  it("opens the rescue only once every owner and admin is gone", async () => {
    const { organizationId, macro } = await labWithMacro();
    const admin = await testApp.createTestUser({ name: "Carol" });
    await testApp.addOrganizationMember(organizationId, admin, "admin");
    const collaborator = await testApp.createTestUser({ name: "Bob" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "admin",
    });
    const personal = await testApp.personalOrganizationId(collaborator);
    await closeAccount(owner);
    await closeAccount(admin);

    // Nobody inside can act any more, so the resource really is stranded.
    expect(await authz.canTransferOut(collaborator, organizationId)).toBe(true);
    assertSuccess(await useCase.execute(collaborator, "macro", macro.id, personal));
    expect(await owningOrgOf(macro.id)).toBe(personal);
  });

  it("refuses a grant revoked after the gate but before the transaction's locks", async () => {
    const { organizationId, macro } = await labWithMacro();
    const collaborator = await testApp.createTestUser({ name: "Bob" });
    const grant = await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "admin",
    });
    const personal = await testApp.personalOrganizationId(collaborator);
    await closeAccount(owner);

    // The window the pre-flight gate cannot cover: the transaction can wait on its
    // locks for a long time, and on this path the organization test passes for
    // everybody, so only re-reading the caller's own access catches the revoke.
    const repo = testApp.module.get(SharingRepository);
    // Bound before the spy replaces the method, so the mock can still reach the
    // real implementation without recursing back through itself.
    const original = repo.transferToOrganization.bind(
      repo,
    ) as SharingRepository["transferToOrganization"];
    vi.spyOn(repo, "transferToOrganization").mockImplementationOnce(async (params) => {
      await testApp.removeResourceGrant(grant.id);
      return original(params);
    });

    const result = await useCase.execute(collaborator, "macro", macro.id, personal);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(await owningOrgOf(macro.id)).toBe(organizationId);
  });

  it("refuses a transfer to an organization the caller does not belong to", async () => {
    const { organizationId, macro } = await labWithMacro();
    const elsewhere = await testApp.createOrganization();

    const result = await useCase.execute(owner, "macro", macro.id, elsewhere);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(await owningOrgOf(macro.id)).toBe(organizationId);
  });

  it("refuses a transfer to the organization that already owns it", async () => {
    const { organizationId, macro } = await labWithMacro();

    const result = await useCase.execute(owner, "macro", macro.id, organizationId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("refuses somebody who cannot manage the resource at all", async () => {
    const { macro } = await labWithMacro();
    const stranger = await testApp.createTestUser({ name: "Stranger" });
    const personal = await testApp.personalOrganizationId(stranger);

    // A public macro anyone can read, and nothing more — the same 403 the rest of
    // the sharing surface gives; a resource that does not exist answers 404.
    const result = await useCase.execute(stranger, "macro", macro.id, personal);

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);

    const missing = await useCase.execute(stranger, "macro", crypto.randomUUID(), personal);
    assertFailure(missing);
    expect(missing.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("drops the source organization's team grants and keeps every other grant", async () => {
    const { organizationId, macro } = await labWithMacro();
    const teamId = await testApp.createTeam(organizationId);
    const teammate = await testApp.createTestUser({ name: "Teammate" });
    await testApp.addTeamMember(teamId, teammate);
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "team",
      granteeId: teamId,
      role: "admin",
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
    });
    const partnerOrg = await testApp.createOrganization();
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "organization",
      granteeId: partnerOrg,
      role: "viewer",
    });
    const personal = await testApp.personalOrganizationId(owner);

    expect(
      (await authz.can(teammate, { resourceType: "macro", resourceId: macro.id, action: "update" }))
        .allow,
    ).toBe(true);

    assertSuccess(await useCase.execute(owner, "macro", macro.id, personal));

    // A team cannot exist outside its organization, so a team grant cannot follow
    // the resource out — the access it conferred goes with it.
    expect(await grantsOn(macro.id, "team")).toEqual([]);
    expect(
      (await authz.can(teammate, { resourceType: "macro", resourceId: macro.id, action: "update" }))
        .allow,
    ).toBe(false);
    // Everything else survives untouched.
    expect(await grantsOn(macro.id, "user")).toEqual([{ granteeId: collaborator, role: "viewer" }]);
    expect(await grantsOn(macro.id, "organization")).toEqual([
      { granteeId: partnerOrg, role: "viewer" },
    ]);
  });

  it("leaves visibility and the embargo alone", async () => {
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, owner, "owner");
    const embargoUntil = new Date("2030-01-01T00:00:00.000Z");
    const { experiment } = await testApp.createExperiment({
      name: "E",
      userId: owner,
      organizationId,
      visibility: "public",
      embargoUntil,
    });
    const personal = await testApp.personalOrganizationId(owner);

    assertSuccess(await useCase.execute(owner, "experiment", experiment.id, personal));

    const ownership = await authz.getOwnership("experiment", experiment.id);
    expect(ownership).toMatchObject({ organizationId: personal, visibility: "public" });
  });

  it("seeds the mover an admin grant when they are only a plain member of the target", async () => {
    const { macro } = await labWithMacro();
    const target = await testApp.createOrganization();
    // The target has to have a living owner of its own, or this would prove the
    // husk branch instead — `orgHasLivingOwner` short-circuits and the read-only
    // membership below is never consulted.
    const targetOwner = await testApp.createTestUser({ name: "Target owner" });
    await testApp.addOrganizationMember(target, targetOwner, "owner");
    // Read-only there: without a seeded grant the mover would come out the other
    // side unable to touch what they just moved.
    await testApp.addOrganizationMember(target, owner, "member");

    assertSuccess(await useCase.execute(owner, "macro", macro.id, target));

    expect(await grantsOn(macro.id, "user")).toEqual([{ granteeId: owner, role: "admin" }]);
    expect(
      (await authz.can(owner, { resourceType: "macro", resourceId: macro.id, action: "manage" }))
        .allow,
    ).toBe(true);
  });

  it("seeds the mover an admin grant when the target organization has no living owner", async () => {
    const { macro } = await labWithMacro();
    // The other branch of the same guard: nobody in the target is answerable, so
    // the resource would land there with nobody able to act on it.
    const target = await testApp.createOrganization();
    const deadOwner = await testApp.createTestUser({ name: "Dead owner" });
    await testApp.addOrganizationMember(target, deadOwner, "owner");
    await testApp.addOrganizationMember(target, owner, "member");
    await closeAccount(deadOwner);

    assertSuccess(await useCase.execute(owner, "macro", macro.id, target));

    expect(await grantsOn(macro.id, "user")).toEqual([{ granteeId: owner, role: "admin" }]);
  });

  it("seeds nothing when the mover already owns the target organization", async () => {
    const { macro } = await labWithMacro();
    const personal = await testApp.personalOrganizationId(owner);

    assertSuccess(await useCase.execute(owner, "macro", macro.id, personal));

    // Owners are not collaborators on their own resources — the Owner row on the
    // sharing surface is synthesized from the organization, not from a grant.
    expect(await grantsOn(macro.id, "user")).toEqual([]);
  });
});
