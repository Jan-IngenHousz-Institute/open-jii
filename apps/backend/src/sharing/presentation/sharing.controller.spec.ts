import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";
import { and, eq, profiles, resourceGrants, teamMembers } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { TestHarness } from "../../test/test-harness";

/**
 * HTTP-level tests for the sharing controller. Authorization runs through the
 * real `can()` (not mocked): a share must actually grant the grantee access, and
 * a revoke must drop it back to the next precedence tier.
 */
describe("SharingController", () => {
  const testApp = TestHarness.App;
  let authz: AuthorizationService;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    authz = testApp.module.get(AuthorizationService);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("share grants the grantee access; revoke drops it back to public-read", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public
    const grantee = await testApp.createTestUser({ name: "Grantee" });

    // Before sharing: grantee can read (public) but not update.
    expect(
      (await authz.can(grantee, { resourceType: "macro", resourceId: macro.id, action: "update" }))
        .allow,
    ).toBe(false);

    const createRes = await testApp
      .post(
        testApp.resolveOrpcPath(contract.sharing.createGrant, {
          resourceType: "macro",
          id: macro.id,
        }),
      )
      .withAuth(owner)
      .send({ granteeType: "user", granteeId: grantee, role: "admin" })
      .expect(StatusCodes.CREATED);

    // The list comes back with the creator's own grant beside the new one.
    const grants = createRes.body as ResourceGrantDto[];
    const granteeGrants = grants.filter((grant) => grant.granteeId === grantee);
    expect(granteeGrants).toHaveLength(1);
    expect(grants.map((grant) => grant.granteeId).sort()).toEqual([owner, grantee].sort());

    // After sharing: the admin grant lets the grantee update.
    expect(
      (await authz.can(grantee, { resourceType: "macro", resourceId: macro.id, action: "update" }))
        .allow,
    ).toBe(true);

    await testApp
      .delete(
        testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
          resourceType: "macro",
          id: macro.id,
          grantId: granteeGrants[0].id,
        }),
      )
      .withAuth(owner)
      .expect(StatusCodes.NO_CONTENT);

    // After revoke: update is denied again, but public-read still applies.
    expect(
      (await authz.can(grantee, { resourceType: "macro", resourceId: macro.id, action: "update" }))
        .allow,
    ).toBe(false);
    expect(
      (await authz.can(grantee, { resourceType: "macro", resourceId: macro.id, action: "read" }))
        .allow,
    ).toBe(true);
  });

  it("rejects a non-sharer (plain public reader) with 403", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const reader = await testApp.createTestUser({ name: "Reader" });
    const target = await testApp.createTestUser({ name: "Target" });

    await testApp
      .post(
        testApp.resolveOrpcPath(contract.sharing.createGrant, {
          resourceType: "macro",
          id: macro.id,
        }),
      )
      .withAuth(reader)
      .send({ granteeType: "user", granteeId: target, role: "viewer" })
      .expect(StatusCodes.FORBIDDEN);
  });

  describe("leaveResource", () => {
    it("routes DELETE …/collaborators/me to leave, not to revokeGrant's {grantId}", async () => {
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner,
        visibility: "private",
      });
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      });

      // A viewer holds no `share`, so if `me` were swallowed by the
      // `{grantId}` route this would be a 400 (uuid validation) — never 204.
      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.sharing.leaveResource, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(viewer)
        .expect(StatusCodes.NO_CONTENT);

      expect(
        (await authz.can(viewer, { resourceType: "macro", resourceId: macro.id, action: "read" }))
          .allow,
      ).toBe(false);
    });

    it("returns 404 to a caller without a direct grant", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public
      const reader = await testApp.createTestUser({ name: "Reader" });

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.sharing.leaveResource, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(reader)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("searchGranteeOrganizations", () => {
    const searchPath = () => testApp.resolveOrpcPath(contract.sharing.searchGranteeOrganizations);

    it("returns only the caller's own organizations, excluding personal workspaces", async () => {
      const mine = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(mine, owner, "member");
      // A separate org the caller does not belong to must not be enumerable.
      await testApp.createOrganization("Someone Else Lab");
      // Touch the personal org so it exists for this user.
      await testApp.createMacro({ name: "M", createdBy: owner });

      const res = await testApp.get(searchPath()).withAuth(owner).expect(StatusCodes.OK);

      const orgs = res.body as { id: string; name: string; slug: string | null }[];
      expect(orgs.map((o) => o.id)).toEqual([mine]);
      expect(orgs.every((o) => !o.slug?.startsWith("personal-"))).toBe(true);
    });

    it("filters by name substring", async () => {
      const drought = await testApp.createOrganization("Drought Consortium");
      const other = await testApp.createOrganization("Photosynthesis Group");
      await testApp.addOrganizationMember(drought, owner, "member");
      await testApp.addOrganizationMember(other, owner, "member");

      const res = await testApp
        .get(`${searchPath()}?query=drought`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      expect((res.body as { id: string }[]).map((o) => o.id)).toEqual([drought]);
    });
  });

  describe("transferResourceAdmin", () => {
    const transferPath = () => testApp.resolveOrpcPath(contract.sharing.transferResourceAdmin);

    it("hands admin to the target across resource types in one request", async () => {
      const successor = await testApp.createTestUser({ name: "Successor" });
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner,
        visibility: "private",
      });
      const protocol = await testApp.createProtocol({
        name: "P",
        createdBy: owner,
        visibility: "private",
      });

      // The successor starts with no access at all to either private resource.
      for (const [resourceType, resourceId] of [
        ["macro", macro.id],
        ["protocol", protocol.id],
      ] as const) {
        expect(
          (await authz.can(successor, { resourceType, resourceId, action: "read" })).allow,
        ).toBe(false);
      }

      const res = await testApp
        .post(transferPath())
        .withAuth(owner)
        .send({
          transfers: [
            { resourceType: "macro", resourceId: macro.id, targetUserId: successor },
            { resourceType: "protocol", resourceId: protocol.id, targetUserId: successor },
          ],
        })
        .expect(StatusCodes.OK);

      const { results } = res.body as {
        results: { resourceType: string; resourceId: string; success: boolean }[];
      };
      expect(results).toEqual([
        { resourceType: "macro", resourceId: macro.id, success: true },
        { resourceType: "protocol", resourceId: protocol.id, success: true },
      ]);

      // Real `can()`: the grant actually confers management, not just a 200.
      for (const [resourceType, resourceId] of [
        ["macro", macro.id],
        ["protocol", protocol.id],
      ] as const) {
        expect(
          (await authz.can(successor, { resourceType, resourceId, action: "manage" })).allow,
        ).toBe(true);
      }
    });
  });

  describe("team grantees", () => {
    const createPath = (macroId: string) =>
      testApp.resolveOrpcPath(contract.sharing.createGrant, {
        resourceType: "macro",
        id: macroId,
      });

    /** A macro owned by a real organization, plus one of its teams. */
    async function labWithTeam() {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, owner, "owner");
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner,
        organizationId,
        visibility: "private",
      });
      const teamId = await testApp.createTeam(organizationId, "Field crew");
      const teammate = await testApp.createTestUser({ name: "Teammate" });
      await testApp.addTeamMember(teamId, teammate);
      return { organizationId, macro, teamId, teammate };
    }

    it("gives a team's members read through a 'Can view' grant", async () => {
      const { macro, teamId, teammate } = await labWithTeam();

      await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: teamId, role: "viewer" })
        .expect(StatusCodes.CREATED);

      expect(
        (await authz.can(teammate, { resourceType: "macro", resourceId: macro.id, action: "read" }))
          .allow,
      ).toBe(true);
      expect(
        (
          await authz.can(teammate, {
            resourceType: "macro",
            resourceId: macro.id,
            action: "update",
          })
        ).allow,
      ).toBe(false);
    });

    it("gives them full control through a 'Can edit' grant", async () => {
      const { macro, teamId, teammate } = await labWithTeam();

      await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: teamId, role: "admin" })
        .expect(StatusCodes.CREATED);

      const decision = await authz.can(teammate, {
        resourceType: "macro",
        resourceId: macro.id,
        action: "manage",
      });
      expect(decision).toMatchObject({ allow: true, reason: "resource-grant:team" });
    });

    it("drops the access path when the member leaves the team", async () => {
      const { macro, teamId, teammate } = await labWithTeam();
      await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: teamId, role: "admin" })
        .expect(StatusCodes.CREATED);

      await testApp.database
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, teammate)));

      // Team access is membership, not a copy of the grant: it goes the moment
      // they are out of the team, with the grant row untouched.
      expect(
        (await authz.can(teammate, { resourceType: "macro", resourceId: macro.id, action: "read" }))
          .allow,
      ).toBe(false);
    });

    it("refuses a team from another organization", async () => {
      const { macro } = await labWithTeam();
      const elsewhere = await testApp.createOrganization();
      await testApp.addOrganizationMember(elsewhere, owner, "owner");
      const foreignTeam = await testApp.createTeam(elsewhere, "Outsiders");

      // A team cannot exist outside its own organization, so granting one access
      // here would be access the owning organization could never account for.
      await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: foreignTeam, role: "viewer" })
        .expect(StatusCodes.BAD_REQUEST);

      expect(
        await testApp.database
          .select({ id: resourceGrants.id })
          .from(resourceGrants)
          .where(
            and(eq(resourceGrants.resourceId, macro.id), eq(resourceGrants.granteeType, "team")),
          ),
      ).toEqual([]);
    });

    it("lists the team by name and head count, and never as an outside collaborator", async () => {
      const { macro, teamId } = await labWithTeam();
      await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: teamId, role: "viewer" })
        .expect(StatusCodes.CREATED);

      const res = await testApp
        .get(
          testApp.resolveOrpcPath(contract.sharing.listGrants, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(owner)
        .expect(StatusCodes.OK);

      const grants = res.body as ResourceGrantDto[];
      const teamRow = grants.find((grant) => grant.granteeId === teamId);
      expect(teamRow).toMatchObject({
        granteeType: "team",
        isOutsideCollaborator: false,
        grantee: { type: "team", displayName: "Field crew", memberCount: 1, email: null },
      });
    });

    it("re-tiers and revokes a team grant like any other", async () => {
      const { macro, teamId, teammate } = await labWithTeam();
      const created = await testApp
        .post(createPath(macro.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: teamId, role: "viewer" })
        .expect(StatusCodes.CREATED);
      const teamGrant = (created.body as ResourceGrantDto[]).find(
        (grant) => grant.granteeId === teamId,
      );
      if (!teamGrant) throw new Error("The team grant is missing from the create response");
      const grantId = teamGrant.id;

      await testApp
        .patch(
          testApp.resolveOrpcPath(contract.sharing.updateGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId,
          }),
        )
        .withAuth(owner)
        .send({ role: "admin" })
        .expect(StatusCodes.OK);
      expect(
        (
          await authz.can(teammate, {
            resourceType: "macro",
            resourceId: macro.id,
            action: "update",
          })
        ).allow,
      ).toBe(true);

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId,
          }),
        )
        .withAuth(owner)
        .expect(StatusCodes.NO_CONTENT);
      expect(
        (await authz.can(teammate, { resourceType: "macro", resourceId: macro.id, action: "read" }))
          .allow,
      ).toBe(false);
    });

    it("does not let a team grant stand in for the last admin", async () => {
      const { organizationId, macro, teamId } = await labWithTeam();
      const soleAdmin = await testApp.createTestUser({ name: "Sole admin" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: soleAdmin,
        role: "admin",
      });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "team",
        granteeId: teamId,
        role: "admin",
      });
      // The husk case, where the invariant applies: no living organization owner,
      // so the last full-control *user* grant is all that is holding the macro up.
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, owner));
      await testApp.addOrganizationMember(organizationId, soleAdmin, "member");

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId: grant.id,
          }),
        )
        .withAuth(soleAdmin)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("transferResourceOrganization", () => {
    it("moves the resource and answers with its new organization", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId });
      const personal = await testApp.personalOrganizationId(owner);

      const res = await testApp
        .post(
          testApp.resolveOrpcPath(contract.sharing.transferResourceOrganization, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(owner)
        .send({ targetOrganizationId: personal })
        .expect(StatusCodes.OK);

      expect(res.body).toEqual({
        resourceType: "macro",
        resourceId: macro.id,
        organizationId: personal,
      });
    });

    it("refuses a device before any handler sees it", async () => {
      const device = await testApp.createIotDevice({ createdBy: owner });
      const personal = await testApp.personalOrganizationId(owner);

      // A device's AWS Thing and certificate are provisioned against its
      // organization, so it has no transfer — the contract's resource-type enum
      // leaves it out and validation refuses the call.
      await testApp
        .post(`/api/v1/device/${device.id}/transfer`)
        .withAuth(owner)
        .send({ targetOrganizationId: personal })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("the grantable role set is narrower than the stored one", () => {
    it("refuses a create that tries to grant 'owner' with a 400", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const grantee = await testApp.createTestUser({ name: "Would-be Owner" });

      // Ownership follows from the owning organization; a share cannot hand it over.
      // Refused by contract validation, before any use case sees it.
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.sharing.createGrant, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "owner" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("refuses an update to 'owner' with a 400", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const grantee = await testApp.createTestUser({ name: "Grantee" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });

      await testApp
        .patch(
          testApp.resolveOrpcPath(contract.sharing.updateGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId: grant.id,
          }),
        )
        .withAuth(owner)
        .send({ role: "owner" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("still lists a stored 'owner' grant", async () => {
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner,
        visibility: "private",
      });
      const legacy = await testApp.createTestUser({ name: "Legacy Owner Grant" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: legacy,
        role: "owner",
      });

      const res = await testApp
        .get(
          testApp.resolveOrpcPath(contract.sharing.listGrants, {
            resourceType: "macro",
            id: macro.id,
          }),
        )
        .withAuth(owner)
        .expect(StatusCodes.OK);

      // The other half of the asymmetry: no caller can write this row, and response
      // validation still has to let it through rather than 500 on the whole list.
      const grants = res.body as ResourceGrantDto[];
      const stored = grants.find((grant) => grant.granteeId === legacy);
      expect(stored?.role).toBe("owner");
    });
  });

  describe("grant write failures surface as errors", () => {
    it("returns an error when updating a grant that does not exist", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });

      await testApp
        .patch(
          testApp.resolveOrpcPath(contract.sharing.updateGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId: crypto.randomUUID(),
          }),
        )
        .withAuth(owner)
        .send({ role: "viewer" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("returns an error when revoking a grant that does not exist", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
            resourceType: "macro",
            id: macro.id,
            grantId: crypto.randomUUID(),
          }),
        )
        .withAuth(owner)
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
