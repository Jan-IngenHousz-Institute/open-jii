import { StatusCodes } from "http-status-codes";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import {
  and,
  createSecondaryDatabase,
  eq,
  inArray,
  profiles,
  resourceGrants,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AuthorizationService } from "../authorization/authorization.service";
import { assertFailure, assertSuccess } from "../common/utils/fp-utils";
import { MacroRepository } from "../macros/core/repositories/macro.repository";
import { TestHarness } from "../test/test-harness";
import { SharingRepository } from "./sharing.repository";
import { CreateGrantUseCase } from "./use-cases/create-grant";
import { ListGrantsUseCase } from "./use-cases/list-grants";
import { RevokeGrantUseCase } from "./use-cases/revoke-grant";
import { UpdateGrantUseCase } from "./use-cases/update-grant";

/**
 * The last-admin invariant, which is **conditional**: a resource must never be
 * left with nobody in full control, but the owning organization's living owners
 * already provide that. So while one of them exists the invariant stands down and
 * every grant — the last admin one included — is freely revocable; it bites only
 * on a *husk*, a resource whose owning org has no living owner left.
 *
 * A creator holds no grant on what they create, so the "sole admin" being
 * protected is never the creator: it is somebody the resource was handed to, on a
 * resource whose owner has since closed their account.
 *
 * Everything here is exercised through the use cases rather than the repository,
 * because the invariant's whole point is that **no** write path a `can(share)`
 * holder can reach gets around it — POST included, since re-sharing is an upsert
 * that can lower an existing role.
 */
describe("last-admin invariant (sharing use-cases)", () => {
  const testApp = TestHarness.App;
  let createGrant: CreateGrantUseCase;
  let updateGrant: UpdateGrantUseCase;
  let revokeGrant: RevokeGrantUseCase;
  let authz: AuthorizationService;
  let owner: string;

  // A repository on its own connection. The app's pool is `max: 1`, so two writes
  // issued through `testApp` are serialized by the driver and never contend in
  // Postgres — a race driven only through it would pass even with no lock at all.
  // This second connection is what makes `SELECT … FOR UPDATE` actually block.
  let secondary: { database: DatabaseInstance; close: () => Promise<void> };
  let secondaryRepo: SharingRepository;

  beforeAll(async () => {
    await testApp.setup();
    secondary = createSecondaryDatabase();
    secondaryRepo = new SharingRepository(secondary.database);
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    createGrant = testApp.module.get(CreateGrantUseCase);
    updateGrant = testApp.module.get(UpdateGrantUseCase);
    revokeGrant = testApp.module.get(RevokeGrantUseCase);
    authz = testApp.module.get(AuthorizationService);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await secondary.close();
    await testApp.teardown();
  });

  /** A grantee's direct grant on a resource. */
  async function directGrant(
    resourceId: string,
    userId: string,
    resourceType: SharingResourceType = "experiment",
  ) {
    const [row] = await testApp.database
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
    return row;
  }

  /** How many user grants with a staffing role remain. */
  async function staffingGrantCount(
    resourceId: string,
    resourceType: SharingResourceType = "experiment",
  ) {
    const rows = await testApp.database
      .select({ id: resourceGrants.id })
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, resourceType),
          eq(resourceGrants.resourceId, resourceId),
          eq(resourceGrants.granteeType, "user"),
          inArray(resourceGrants.role, ["owner", "admin"]),
        ),
      );
    return rows.length;
  }

  /**
   * Close an account the way `UserRepository.delete` does, as far as ownership is
   * concerned: the profile is soft-deleted while the org membership row stays. That
   * is what turns the personal org into a husk — it still has an owner row, but
   * nobody living behind it.
   */
  async function closeAccount(userId: string) {
    await testApp.database
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.userId, userId));
  }

  async function seedExperiment() {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
    });
    return experiment;
  }

  /** Give someone a direct admin grant through the real write path. */
  async function shareAdmin(
    resourceId: string,
    granteeId: string,
    resourceType: SharingResourceType = "experiment",
    sharer: string = owner,
  ) {
    assertSuccess(
      await createGrant.execute(sharer, resourceType, resourceId, {
        granteeType: "user",
        granteeId,
        role: "admin",
      }),
    );
    return directGrant(resourceId, granteeId, resourceType);
  }

  /**
   * A creator ends up in control of what they made either way: through the org
   * role where that already covers it, and through a seeded grant where it does
   * not. Every other fixture in this file creates into a personal workspace, where
   * the creator is the owner — these cover the cases where they are not.
   */
  describe("creator control at create time", () => {
    const createMacroIn = async (organizationId: string | null, userId: string) => {
      const result = await testApp.module.get(MacroRepository).create(
        {
          name: `Macro ${crypto.randomUUID()}`,
          description: "d",
          language: "python",
          code: btoa("print(1)"),
        },
        userId,
        organizationId,
      );
      assertSuccess(result);
      return result.value[0];
    };

    /** A shared organization with a distinct owner, plus `role` for the subject. */
    async function sharedOrgWith(role: "member" | "admin") {
      const org = await testApp.createOrganization();
      const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
      await testApp.addOrganizationMember(org, orgOwner, "owner");
      const subject = await testApp.createTestUser({ name: `Org ${role}` });
      await testApp.addOrganizationMember(org, subject, role);
      return { org, orgOwner, subject };
    }

    it("seeds a member creator an admin grant, so they can still manage their own work", async () => {
      const { org, subject } = await sharedOrgWith("member");

      const macro = await createMacroIn(org, subject);

      // An org `member` is read-only. Without this grant the creator could not
      // update, share or manage the macro they had just made.
      expect((await directGrant(macro.id, subject, "macro")).role).toBe("admin");
      for (const action of ["update", "share", "manage"] as const) {
        expect(
          (await authz.can(subject, { resourceType: "macro", resourceId: macro.id, action })).allow,
        ).toBe(true);
      }
    });

    it("seeds an admin creator nothing — their org role already covers it", async () => {
      const { org, subject } = await sharedOrgWith("admin");

      const macro = await createMacroIn(org, subject);

      expect(await directGrant(macro.id, subject, "macro")).toBeUndefined();
      expect(
        (
          await authz.can(subject, {
            resourceType: "macro",
            resourceId: macro.id,
            action: "manage",
          })
        ).allow,
      ).toBe(true);
    });

    it("seeds an owner creator nothing", async () => {
      const macro = await createMacroIn(null, owner);

      expect(await directGrant(macro.id, owner, "macro")).toBeUndefined();
    });

    it("seeds a grant when the organization has no living owner", async () => {
      const { org, orgOwner, subject } = await sharedOrgWith("admin");
      await closeAccount(orgOwner);

      const macro = await createMacroIn(org, subject);

      // Nobody inherits control in a husk org, so even a creator whose role would
      // normally be enough needs a grant — otherwise the macro is born unstaffed.
      expect((await directGrant(macro.id, subject, "macro")).role).toBe("admin");
    });
  });

  /**
   * `organization_members.role` may hold several comma-separated roles, and the
   * canonical evaluator accepts the row if *any* token grants. Every SQL-side
   * ownership question has to agree with it — string equality silently does not.
   */
  describe("multi-role memberships", () => {
    const createMacroIn = async (organizationId: string, userId: string) => {
      const result = await testApp.module.get(MacroRepository).create(
        {
          name: `Macro ${crypto.randomUUID()}`,
          description: "d",
          language: "python",
          code: btoa("print(1)"),
        },
        userId,
        organizationId,
      );
      assertSuccess(result);
      return result.value[0];
    };

    it("treats 'member,admin' as full control, so no redundant grant is seeded", async () => {
      const org = await testApp.createOrganization();
      const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
      await testApp.addOrganizationMember(org, orgOwner, "owner");
      const multi = await testApp.createTestUser({ name: "Multi Role" });
      await testApp.addOrganizationMember(org, multi, "member,admin" as "admin");

      const macro = await createMacroIn(org, multi);

      // `can()` reads them as an admin, so a grant would raise nothing.
      expect(await directGrant(macro.id, multi, "macro")).toBeUndefined();
      expect(
        (await authz.can(multi, { resourceType: "macro", resourceId: macro.id, action: "manage" }))
          .allow,
      ).toBe(true);
    });

    // The evaluator splits on commas and trims each token — it does not strip
    // spaces from inside one. These pin the SQL to that same reading.
    it.each([
      [" member , admin ", true],
      ["member,\tadmin", true],
      // Vertical tab and NBSP are stripped by `String.prototype.trim()` but not by
      // Postgres' `\s`, so an explicit charset is the only way to agree with it.
      ["member,\vadmin", true],
      ["\u00A0admin", true],
      ["ad min", false],
    ])("reads %j as full control: %s", async (role, confersControl) => {
      const org = await testApp.createOrganization();
      const orgOwner = await testApp.createTestUser({ name: "Org Owner" });
      await testApp.addOrganizationMember(org, orgOwner, "owner");
      const subject = await testApp.createTestUser({ name: "Odd Role" });
      await testApp.addOrganizationMember(org, subject, role as "admin");

      const macro = await createMacroIn(org, subject);

      // Full control ⇒ nothing to seed. Not full control ⇒ the creator would be
      // locked out of their own macro without a grant, so one is seeded.
      expect(await directGrant(macro.id, subject, "macro")).toEqual(
        confersControl ? undefined : expect.objectContaining({ role: "admin" }),
      );
    });

    it("counts an NBSP-padded 'owner' token as a living owner", async () => {
      const org = await testApp.createOrganization();
      const paddedOwner = await testApp.createTestUser({ name: "Padded Owner" });
      await testApp.addOrganizationMember(org, paddedOwner, "\u00A0owner\u00A0" as "owner");
      const macro = await testApp.createMacro({
        name: `M ${crypto.randomUUID()}`,
        createdBy: paddedOwner,
        organizationId: org,
      });
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(macro.id, keeper, "macro", paddedOwner);

      // `can()` trims the token and reads them as the owner, so the staffing rules
      // have to as well — otherwise this macro looks like a husk.
      assertSuccess(await revokeGrant.execute(paddedOwner, "macro", macro.id, grant.id));
      expect(await directGrant(macro.id, keeper, "macro")).toBeUndefined();
    });

    it("counts 'member,owner' as a living owner, so the invariant stands down", async () => {
      const org = await testApp.createOrganization();
      const multiOwner = await testApp.createTestUser({ name: "Multi Owner" });
      await testApp.addOrganizationMember(org, multiOwner, "member,owner" as "owner");
      const macro = await testApp.createMacro({
        name: `M ${crypto.randomUUID()}`,
        createdBy: multiOwner,
        organizationId: org,
      });
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(macro.id, keeper, "macro", multiOwner);

      // Missing this owner would put the macro into the husk rules and refuse a
      // revoke that should be free.
      assertSuccess(await revokeGrant.execute(multiOwner, "macro", macro.id, grant.id));
      expect(await directGrant(macro.id, keeper, "macro")).toBeUndefined();
    });

    it("shows a 'member,owner' membership as an Owner row on the collaborators surface", async () => {
      const org = await testApp.createOrganization();
      const multiOwner = await testApp.createTestUser({ name: "Multi Owner" });
      await testApp.addOrganizationMember(org, multiOwner, "member,owner" as "owner");
      const macro = await testApp.createMacro({
        name: `M ${crypto.randomUUID()}`,
        createdBy: multiOwner,
        organizationId: org,
      });

      const listed = await testApp.module
        .get(ListGrantsUseCase)
        .execute(multiOwner, "macro", macro.id);
      assertSuccess(listed);
      expect(listed.value.map((row) => [row.kind, row.granteeId])).toEqual([["owner", multiOwner]]);
    });
  });

  /**
   * The personal organization is provisioned at sign-up, before onboarding writes a
   * profile row — so a profile-less owner is a real, reachable state, not a
   * fixture artifact. They must count as living everywhere.
   */
  describe("an owner who has not finished onboarding", () => {
    it("still counts as a living owner, so the invariant stands down", async () => {
      const preOnboarding = await testApp.createTestUser({
        name: "Pre Onboarding",
        createProfile: false,
      });
      const macro = await testApp.createMacro({ name: "M", createdBy: preOnboarding });
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(macro.id, keeper, "macro", preOnboarding);

      // Treating them as dead would put this macro into the husk rules and refuse
      // the revoke, stranding the grant on a resource that has a perfectly good
      // owner.
      assertSuccess(await revokeGrant.execute(preOnboarding, "macro", macro.id, grant.id));
      expect(await directGrant(macro.id, keeper, "macro")).toBeUndefined();
    });
  });

  describe("while the owning organization has a living owner", () => {
    it("allows revoking the only admin grant", async () => {
      const experiment = await seedExperiment();
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(experiment.id, keeper);

      // Nothing to protect: the owner is answerable for the experiment whether or
      // not anybody holds a grant on it.
      assertSuccess(await revokeGrant.execute(owner, "experiment", experiment.id, grant.id));

      expect(await directGrant(experiment.id, keeper)).toBeUndefined();
      expect(await staffingGrantCount(experiment.id)).toBe(0);
    });

    it("allows demoting the only admin grant", async () => {
      const experiment = await seedExperiment();
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(experiment.id, keeper);

      assertSuccess(
        await updateGrant.execute(owner, "experiment", experiment.id, grant.id, {
          role: "viewer",
        }),
      );

      expect((await directGrant(experiment.id, keeper)).role).toBe("viewer");
    });

    it("allows demoting the only admin by re-sharing them at a lower role", async () => {
      const experiment = await seedExperiment();
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      await shareAdmin(experiment.id, keeper);

      assertSuccess(
        await createGrant.execute(owner, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: keeper,
          role: "viewer",
        }),
      );

      expect((await directGrant(experiment.id, keeper)).role).toBe("viewer");
    });

    it("leaves the creator with no grant of their own to revoke", async () => {
      const experiment = await seedExperiment();

      // The creator is an owner, not a collaborator — there is no row for them.
      expect(await directGrant(experiment.id, owner)).toBeUndefined();
      expect(await staffingGrantCount(experiment.id)).toBe(0);
    });
  });

  describe("on a husk-org resource (owner's account closed)", () => {
    /**
     * The state a completed account deletion leaves behind: the owner is gone, and
     * the only person in full control is whoever they handed admin to.
     */
    async function seedHusk() {
      const experiment = await seedExperiment();
      const keeper = await testApp.createTestUser({ name: "Keeper" });
      const grant = await shareAdmin(experiment.id, keeper);
      await closeAccount(owner);
      return { experiment, keeper, grant };
    }

    it("refuses to revoke the last admin grant", async () => {
      const { experiment, keeper, grant } = await seedHusk();

      const result = await revokeGrant.execute(keeper, "experiment", experiment.id, grant.id);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(result.error.message).toContain("last admin");
      // Still there — the refusal happens before the delete, not after it.
      expect(await directGrant(experiment.id, keeper)).toBeDefined();
    });

    it("refuses to demote the last admin grant", async () => {
      const { experiment, keeper, grant } = await seedHusk();

      const result = await updateGrant.execute(keeper, "experiment", experiment.id, grant.id, {
        role: "viewer",
      });

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(result.error.message).toContain("last admin");
      expect((await directGrant(experiment.id, keeper)).role).toBe("admin");
    });

    // POST is an upsert, so it is a demotion path too.
    it("refuses to demote the last admin by re-sharing them at a lower role", async () => {
      const { experiment, keeper } = await seedHusk();

      const result = await createGrant.execute(keeper, "experiment", experiment.id, {
        granteeType: "user",
        granteeId: keeper,
        role: "viewer",
      });

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(result.error.message).toContain("last admin");
      // The upsert never ran: the sole staffing grant is untouched.
      expect((await directGrant(experiment.id, keeper)).role).toBe("admin");
    });

    it("allows revoking an admin grant once a second one exists", async () => {
      const { experiment, keeper, grant } = await seedHusk();
      const second = await testApp.createTestUser({ name: "Second" });
      assertSuccess(
        await createGrant.execute(keeper, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: second,
          role: "admin",
        }),
      );

      assertSuccess(await revokeGrant.execute(keeper, "experiment", experiment.id, grant.id));

      expect(await directGrant(experiment.id, keeper)).toBeUndefined();
      expect((await directGrant(experiment.id, second)).role).toBe("admin");
    });

    it("still allows re-sharing the last admin at the same or a higher role", async () => {
      const { experiment, keeper } = await seedHusk();

      // Not a demotion, so the invariant has nothing to say — and the upsert must
      // remain idempotent for the re-share case the picker relies on.
      assertSuccess(
        await createGrant.execute(keeper, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: keeper,
          role: "admin",
        }),
      );

      expect((await directGrant(experiment.id, keeper)).role).toBe("admin");
    });

    it("stays silent when a non-staffing grant is revoked", async () => {
      const { experiment, keeper } = await seedHusk();
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      assertSuccess(
        await createGrant.execute(keeper, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: viewer,
          role: "viewer",
        }),
      );

      // Revoking a viewer never touches the admin count, so the invariant is silent.
      const grant = await directGrant(experiment.id, viewer);
      assertSuccess(await revokeGrant.execute(keeper, "experiment", experiment.id, grant.id));
      expect(await directGrant(experiment.id, viewer)).toBeUndefined();
    });

    it("lets a brand-new grantee be added at any role", async () => {
      const { experiment, keeper } = await seedHusk();
      const newcomer = await testApp.createTestUser({ name: "Newcomer" });

      // No existing row for this grantee ⇒ nothing is being demoted.
      assertSuccess(
        await createGrant.execute(keeper, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: newcomer,
          role: "viewer",
        }),
      );

      expect((await directGrant(experiment.id, newcomer)).role).toBe("viewer");
    });

    it("does not count an organization grant as staffing", async () => {
      const { experiment, keeper, grant } = await seedHusk();
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, keeper, "owner");
      assertSuccess(
        await createGrant.execute(keeper, "experiment", experiment.id, {
          granteeType: "organization",
          granteeId: orgId,
          role: "admin",
        }),
      );

      // "Someone in that org can administer it" is not an answerable owner, so
      // the keeper's grant is still the last one standing.
      const result = await revokeGrant.execute(keeper, "experiment", experiment.id, grant.id);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("does not count a soft-deleted org owner as living", async () => {
      const { experiment, keeper, grant } = await seedHusk();

      // The owner row still exists in `organization_members` — only the profile is
      // soft-deleted. If the query looked at membership alone this would pass and
      // the resource would be left unstaffed.
      const result = await revokeGrant.execute(keeper, "experiment", experiment.id, grant.id);

      assertFailure(result);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
      expect(grant.role).toBe("admin");
    });
  });

  // The assert and the mutation must be one transaction with the staffing rows
  // locked, or two concurrent demotes each see a count of 2 and both commit.
  //
  // Both sides of these races run on *different connections* (see `secondary`), so
  // they genuinely overlap in Postgres and the row lock is what resolves them.
  describe("under real concurrent connections", () => {
    async function seedHuskWithTwoAdmins() {
      const experiment = await seedExperiment();
      const first = await testApp.createTestUser({ name: `First ${crypto.randomUUID()}` });
      const second = await testApp.createTestUser({ name: `Second ${crypto.randomUUID()}` });
      const firstGrant = await shareAdmin(experiment.id, first);
      const secondGrant = await shareAdmin(experiment.id, second);
      // Only a husk still enforces the invariant, so that is where the race matters.
      await closeAccount(owner);
      return { experiment, first, firstGrant, secondGrant };
    }

    it("survives concurrent demotions of the only two admins", async () => {
      const { experiment, first, firstGrant, secondGrant } = await seedHuskWithTwoAdmins();

      const outcomes = await Promise.all([
        secondaryRepo.updateRole({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: firstGrant.id,
          role: "viewer",
        }),
        updateGrant.execute(first, "experiment", experiment.id, secondGrant.id, {
          role: "viewer",
        }),
      ]);

      // Exactly one demotion may win; the other must be refused so a staffing grant
      // always survives.
      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("survives a concurrent revoke and demote of the only two admins", async () => {
      const { experiment, first, firstGrant, secondGrant } = await seedHuskWithTwoAdmins();

      const outcomes = await Promise.all([
        secondaryRepo.revoke({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: firstGrant.id,
        }),
        updateGrant.execute(first, "experiment", experiment.id, secondGrant.id, {
          role: "viewer",
        }),
      ]);

      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });

    it("survives a concurrent revoke and demoting re-share of the only two admins", async () => {
      // The create-upsert is a demotion path too, so it has to contend on the same
      // lock as the other two.
      const { experiment, first, firstGrant, secondGrant } = await seedHuskWithTwoAdmins();
      const secondId = (
        await testApp.database
          .select({ granteeId: resourceGrants.granteeId })
          .from(resourceGrants)
          .where(eq(resourceGrants.id, secondGrant.id))
      )[0].granteeId;

      const outcomes = await Promise.all([
        secondaryRepo.revoke({
          resourceType: "experiment",
          resourceId: experiment.id,
          grantId: firstGrant.id,
        }),
        createGrant.execute(first, "experiment", experiment.id, {
          granteeType: "user",
          granteeId: secondId,
          role: "viewer",
        }),
      ]);

      expect(outcomes.filter((r) => r.isSuccess())).toHaveLength(1);
      expect(await staffingGrantCount(experiment.id)).toBe(1);
    });
  });

  // All four shareable types behave identically: the invariant stands down while
  // the owning org has a living owner and bites once it does not.
  describe.each([
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
  ])("on a %s", (resourceType, create) => {
    it("creates without any grant, the creator included", async () => {
      const resource = await create(owner);

      expect(await directGrant(resource.id, owner, resourceType)).toBeUndefined();
      expect(await staffingGrantCount(resource.id, resourceType)).toBe(0);
    });

    it("allows revoking the only admin grant while the owner lives", async () => {
      const resource = await create(owner);
      const keeper = await testApp.createTestUser({ name: `Keeper ${crypto.randomUUID()}` });
      const grant = await shareAdmin(resource.id, keeper, resourceType);

      assertSuccess(await revokeGrant.execute(owner, resourceType, resource.id, grant.id));

      expect(await directGrant(resource.id, keeper, resourceType)).toBeUndefined();
    });

    it("refuses to revoke the last admin grant once the owner's account is closed", async () => {
      const resource = await create(owner);
      const keeper = await testApp.createTestUser({ name: `Keeper ${crypto.randomUUID()}` });
      const grant = await shareAdmin(resource.id, keeper, resourceType);
      await closeAccount(owner);

      const result = await revokeGrant.execute(keeper, resourceType, resource.id, grant.id);

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(result.error.message).toContain("last admin");
      expect(await directGrant(resource.id, keeper, resourceType)).toBeDefined();
    });

    it("refuses to demote the last admin grant once the owner's account is closed", async () => {
      const resource = await create(owner);
      const keeper = await testApp.createTestUser({ name: `Keeper ${crypto.randomUUID()}` });
      const grant = await shareAdmin(resource.id, keeper, resourceType);
      await closeAccount(owner);

      const result = await updateGrant.execute(keeper, resourceType, resource.id, grant.id, {
        role: "viewer",
      });

      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect((await directGrant(resource.id, keeper, resourceType)).role).toBe("admin");
    });

    it("allows the keeper to hand over and step down once a second admin exists", async () => {
      const resource = await create(owner);
      const keeper = await testApp.createTestUser({ name: `Keeper ${crypto.randomUUID()}` });
      const grant = await shareAdmin(resource.id, keeper, resourceType);
      const successor = await testApp.createTestUser({ name: `Successor ${crypto.randomUUID()}` });
      await shareAdmin(resource.id, successor, resourceType);
      await closeAccount(owner);

      assertSuccess(await revokeGrant.execute(keeper, resourceType, resource.id, grant.id));

      expect(await directGrant(resource.id, keeper, resourceType)).toBeUndefined();
      expect(await staffingGrantCount(resource.id, resourceType)).toBe(1);
    });
  });
});
