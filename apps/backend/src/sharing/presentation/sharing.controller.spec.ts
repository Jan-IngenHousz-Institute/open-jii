import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";

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
