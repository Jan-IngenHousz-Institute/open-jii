import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import type {
  ResourceCollaboratorDto,
  GranteeUserDto,
  ResourceGrantDto,
} from "@repo/api/domains/sharing/sharing.schema";
import { and, eq, notifications, profiles, resourceGrants, teamMembers } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";
import { EmailVisibilityService } from "../../authorization/email-visibility.service";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { SharingRepository } from "../core/repositories/sharing.repository";

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

  describe("searchGranteeUsers", () => {
    const searchPath = (macroId: string) =>
      testApp.resolveOrpcPath(contract.sharing.searchGranteeUsers, {
        resourceType: "macro",
        id: macroId,
      });

    it("annotates each candidate with the access they already hold here", async () => {
      const org = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(org, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId: org });

      const admin = await testApp.createTestUser({ name: "Zephyrine Admin" });
      const member = await testApp.createTestUser({ name: "Zephyrine Member" });
      const outsider = await testApp.createTestUser({ name: "Zephyrine Outsider" });
      const granted = await testApp.createTestUser({ name: "Zephyrine Granted" });
      await testApp.addOrganizationMember(org, admin, "admin");
      await testApp.addOrganizationMember(org, member, "member");
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: granted,
        role: "viewer",
        createdBy: owner,
      });

      const res = await testApp
        .get(`${searchPath(macro.id)}?query=Zephyrine`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      const byId = new Map(
        (res.body as GranteeUserDto[]).map((candidate) => [candidate.userId, candidate]),
      );
      expect(byId.get(admin)).toMatchObject({ organizationRole: "admin", existingGrantRole: null });
      expect(byId.get(member)).toMatchObject({
        organizationRole: "member",
        existingGrantRole: null,
      });
      // Outside the owning org and ungranted: the picker's only fully open case.
      expect(byId.get(outsider)).toMatchObject({
        organizationRole: null,
        existingGrantRole: null,
      });
      expect(byId.get(granted)).toMatchObject({
        organizationRole: null,
        existingGrantRole: "viewer",
      });
    });

    it("reads the role in the owning organization, not in some other one", async () => {
      const owning = await testApp.createOrganization("Owning Lab");
      await testApp.addOrganizationMember(owning, owner, "owner");
      const elsewhere = await testApp.createOrganization("Elsewhere Lab");
      const macro = await testApp.createMacro({
        name: "M",
        createdBy: owner,
        organizationId: owning,
      });

      const stranger = await testApp.createTestUser({ name: "Quilliam Stranger" });
      await testApp.addOrganizationMember(elsewhere, stranger, "owner");

      const res = await testApp
        .get(`${searchPath(macro.id)}?query=Quilliam`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      expect(res.body as GranteeUserDto[]).toMatchObject([
        { userId: stranger, organizationRole: null },
      ]);
    });

    it("is share-gated, so what a candidate holds is not enumerable without it", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public
      const passerBy = await testApp.createTestUser({ name: "Passer By" });

      await testApp
        .get(`${searchPath(macro.id)}?query=passer`)
        .withAuth(passerBy)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("addresses in the picker", () => {
    const searchPath = (macroId: string) =>
      testApp.resolveOrpcPath(contract.sharing.searchGranteeUsers, {
        resourceType: "macro",
        id: macroId,
      });

    it.each([
      ["no query", ""],
      ["a one-character query", "?query=a"],
      ["a one-character query padded with spaces", "?query=%20a%20"],
      ["a limit above 20", "?query=ab&limit=21"],
    ])("rejects %s with 400", async (_label, queryString) => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });

      await testApp
        .get(`${searchPath(macro.id)}${queryString}`)
        .withAuth(owner)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("finds a stranger by name or full address, never showing the address", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const stranger = await testApp.createTestUser({
        name: "Wilhelmina Stranger",
        email: "qvortrup.k@example.com",
      });

      const byName = await testApp
        .get(`${searchPath(macro.id)}?query=Wilhelmina`)
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const byAddress = await testApp
        .get(`${searchPath(macro.id)}?query=QVORTRUP.K@example.com`)
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const byFragment = await testApp
        .get(`${searchPath(macro.id)}?query=qvortrup`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      for (const res of [byName, byAddress]) {
        expect(res.body as GranteeUserDto[]).toEqual([
          expect.objectContaining({ userId: stranger, email: null }),
        ]);
        expect(JSON.stringify(res.body).toLowerCase()).not.toContain("qvortrup.k@example.com");
      }
      expect((byFragment.body as GranteeUserDto[]).map((c) => c.userId)).not.toContain(stranger);
    });

    it("computes exact-email evidence in the grantee search statement", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const email = "exact-evidence@example.test";
      const exactId = await testApp.createTestUser({ name: "Zelda Target", email });
      const nameId = await testApp.createTestUser({ name: `${email} Candidate` });
      const select = vi.spyOn(testApp.database, "select");
      const result = await testApp.module
        .get(SharingRepository)
        .searchGranteeUsers("macro", macro.id, macro.organizationId, {
          query: email.toUpperCase(),
          limit: 20,
        });
      expect(result.isSuccess()).toBe(true);
      if (result.isFailure()) throw result.error;
      expect(result.value).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: exactId, matchedEmail: true }),
          expect.objectContaining({ userId: nameId, matchedEmail: false }),
        ]),
      );
      expect(select).toHaveBeenCalledTimes(1);
      select.mockRestore();
    });

    it("ranks an exact address ahead of more name matches than the page limit", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const email = "crowded@example.com";
      const targetId = await testApp.createTestUser({ name: "Zelda Target", email });
      for (let i = 0; i < 21; i++) {
        await testApp.createTestUser({ name: `${email} Candidate ${i}` });
      }

      const response: SuperTestResponse<GranteeUserDto[]> = await testApp
        .get(searchPath(macro.id))
        .withAuth(owner)
        .query({ query: email.toUpperCase(), limit: 20 })
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(20);
      expect(response.body[0]).toMatchObject({ userId: targetId, email: null, matchedEmail: true });
      for (const candidate of response.body.slice(1))
        expect(candidate).toMatchObject({ matchedEmail: false });
      expect(response.body.every((candidate) => candidate.email === null)).toBe(true);
    });

    it("shows an owner of the organization its members' addresses, but no one else's", async () => {
      const org = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(org, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId: org });
      const member = await testApp.createTestUser({
        name: "Xanthippe Member",
        email: "xmember@example.com",
      });
      const outsider = await testApp.createTestUser({
        name: "Xanthippe Outsider",
        email: "xoutsider@example.com",
      });
      await testApp.addOrganizationMember(org, member, "member");

      const res = await testApp
        .get(`${searchPath(macro.id)}?query=Xanthippe`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      const emails = Object.fromEntries(
        (res.body as GranteeUserDto[]).map((candidate) => [candidate.userId, candidate.email]),
      );
      expect(emails).toEqual({ [member]: "xmember@example.com", [outsider]: null });
    });

    it("shows a share-capable plain member nobody's address", async () => {
      const org = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(org, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId: org });
      const sharer = await testApp.createTestUser({ name: "Sharer" });
      await testApp.addOrganizationMember(org, sharer, "member");
      await testApp.addResourceAdmin("macro", macro.id, sharer);
      await testApp.createTestUser({ name: "Ysolde Member", email: "ysolde@example.com" });

      const res = await testApp
        .get(`${searchPath(macro.id)}?query=Ysolde`)
        .withAuth(sharer)
        .expect(StatusCodes.OK);

      expect((res.body as GranteeUserDto[]).every((candidate) => candidate.email === null)).toBe(
        true,
      );
      expect(JSON.stringify(res.body)).not.toContain("ysolde@example.com");
    });
  });

  describe("addresses on the collaborators list", () => {
    const collaboratorsPath = (experimentId: string) =>
      testApp.resolveOrpcPath(contract.sharing.listGrants, {
        resourceType: "experiment",
        id: experimentId,
      });

    it("never hands a grantee's address back to whoever granted them", async () => {
      const sharer = await testApp.createTestUser({ name: "Sharer" });
      const { experiment } = await testApp.createExperiment({ name: "Mine", userId: sharer });
      const stranger = await testApp.createTestUser({
        name: "Grant Target",
        email: "target@example.com",
      });

      const created = await testApp
        .post(collaboratorsPath(experiment.id))
        .withAuth(sharer)
        .send({ granteeType: "user", granteeId: stranger, role: "viewer" })
        .expect(StatusCodes.CREATED);
      const grant = (created.body as ResourceGrantDto[]).find((row) => row.granteeId === stranger);
      if (!grant) throw new Error("the new grant is missing from the list");

      const updated = await testApp
        .patch(
          testApp.resolveOrpcPath(contract.sharing.updateGrant, {
            resourceType: "experiment",
            id: experiment.id,
            grantId: grant.id,
          }),
        )
        .withAuth(sharer)
        .send({ role: "admin" })
        .expect(StatusCodes.OK);
      const listed = await testApp
        .get(collaboratorsPath(experiment.id))
        .withAuth(sharer)
        .expect(StatusCodes.OK);

      for (const res of [created, updated, listed]) {
        const row = (res.body as ResourceGrantDto[]).find((r) => r.granteeId === stranger);
        expect(row?.grantee.email).toBeNull();
        expect(JSON.stringify(res.body)).not.toContain("target@example.com");
      }
    });

    it("shows an organization admin the address of a member granted on its experiment", async () => {
      const org = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(org, owner, "owner");
      const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
      await testApp.addOrganizationMember(org, orgAdmin, "admin");
      const member = await testApp.createTestUser({ name: "Member", email: "m@example.com" });
      await testApp.addOrganizationMember(org, member, "member");
      const outsider = await testApp.createTestUser({ name: "Outsider", email: "o@example.com" });
      const { experiment } = await testApp.createExperiment({
        name: "Org exp",
        userId: owner,
        organizationId: org,
      });
      await testApp.addExperimentCollaborator(experiment.id, member);
      await testApp.addExperimentCollaborator(experiment.id, outsider);

      const res = await testApp
        .get(collaboratorsPath(experiment.id))
        .withAuth(orgAdmin)
        .expect(StatusCodes.OK);

      const grantRows = (res.body as ResourceGrantDto[]).filter(
        (row) => row.granteeType === "user",
      );
      const emails = Object.fromEntries(grantRows.map((row) => [row.granteeId, row.grantee.email]));
      expect(emails[member]).toBe("m@example.com");
      expect(emails[outsider]).toBeNull();
      expect(JSON.stringify(res.body)).not.toContain("o@example.com");
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

    // A calibration method belongs to whoever owns the bench that produced it, and that
    // can change hands like any other artifact.
    it("moves a calibration definition too", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, owner, "owner");
      const definition = await testApp.createCalibrationDefinition({
        name: `PAR bench ${crypto.randomUUID()}`,
        createdBy: owner,
        organizationId,
      });
      const personal = await testApp.personalOrganizationId(owner);

      const res = await testApp
        .post(
          testApp.resolveOrpcPath(contract.sharing.transferResourceOrganization, {
            resourceType: "calibration_definition",
            id: definition.id,
          }),
        )
        .withAuth(owner)
        .send({ targetOrganizationId: personal })
        .expect(StatusCodes.OK);

      expect(res.body).toEqual({
        resourceType: "calibration_definition",
        resourceId: definition.id,
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

  describe("visibility outages after committed grant writes", () => {
    it.each(["create", "update"] as const)(
      "%s succeeds with a redacted list after visibility lookup fails, without losing access or notification",
      async (operation) => {
        const { experiment } = await testApp.createExperiment({
          name: "Private fixture",
          userId: owner,
          visibility: "private",
        });
        const target = await testApp.createTestUser({
          name: "Grant Target",
          email: "grant-outage@example.test",
        });
        const initial =
          operation === "update"
            ? await testApp.addResourceGrant({
                resourceType: "experiment",
                resourceId: experiment.id,
                granteeType: "user",
                granteeId: target,
                role: "viewer",
                createdBy: owner,
              })
            : null;
        const role = operation === "create" ? "viewer" : "admin";
        const visibility = vi
          .spyOn(testApp.module.get(EmailVisibilityService), "visibleUserEmails")
          .mockRejectedValue(new Error("Visibility database unavailable"));
        const response = initial
          ? await testApp
              .patch(
                testApp.resolveOrpcPath(contract.sharing.updateGrant, {
                  resourceType: "experiment",
                  id: experiment.id,
                  grantId: initial.id,
                }),
              )
              .withAuth(owner)
              .send({ role })
          : await testApp
              .post(
                testApp.resolveOrpcPath(contract.sharing.createGrant, {
                  resourceType: "experiment",
                  id: experiment.id,
                }),
              )
              .withAuth(owner)
              .send({ granteeType: "user", granteeId: target, role });
        const stored = await testApp.database
          .select({ role: resourceGrants.role })
          .from(resourceGrants)
          .where(
            and(eq(resourceGrants.resourceId, experiment.id), eq(resourceGrants.granteeId, target)),
          );
        expect(stored).toEqual([{ role }]);
        expect(
          (
            await authz.can(target, {
              resourceType: "experiment",
              resourceId: experiment.id,
              action: operation === "create" ? "read" : "manage",
            })
          ).allow,
        ).toBe(true);
        const notices = await testApp.database
          .select({ type: notifications.type })
          .from(notifications)
          .where(
            and(eq(notifications.resourceId, experiment.id), eq(notifications.recipientId, target)),
          );
        expect(notices).toEqual([
          { type: operation === "create" ? "resource_access_granted" : "resource_access_changed" },
        ]);
        expect(response.status).toBe(operation === "create" ? StatusCodes.CREATED : StatusCodes.OK);
        const rows = response.body as ResourceCollaboratorDto[];
        expect(rows.filter(isGranteeRow).every((row) => row.grantee.email === null)).toBe(true);
        expect(rows.filter(isGranteeRow).find((row) => row.granteeId === target)).toMatchObject({
          granteeId: target,
          role,
          grantee: { displayName: "Grant Target", email: null },
        });
        expect(JSON.stringify(rows)).not.toContain("grant-outage@example.test");
        expect(visibility).toHaveBeenCalledTimes(1);
      },
    );
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
