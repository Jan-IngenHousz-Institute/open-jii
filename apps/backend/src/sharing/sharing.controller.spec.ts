import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ResourceGrantDto } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../authorization/authorization.service";
import { TestHarness } from "../test/test-harness";

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

    const grants = createRes.body as ResourceGrantDto[];
    expect(grants).toHaveLength(1);
    expect(grants[0].granteeId).toBe(grantee);

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
          grantId: grants[0].id,
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
});
