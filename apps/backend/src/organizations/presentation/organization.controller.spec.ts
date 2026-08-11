import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  GranteeTeamList,
  MyOrganizationList,
  OrganizationDirectory,
  OrganizationMembers,
  OrganizationProfile,
  OrganizationDeletionBlockers,
  OrganizationResources,
  OrganizationTeamList,
} from "@repo/api/domains/organization/organization.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("OrganizationController", () => {
  const testApp = TestHarness.App;
  let ownerId: string;
  let memberId: string;
  let outsiderId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({ email: "owner@example.com", name: "Olive Owner" });
    memberId = await testApp.createTestUser({ email: "member@example.com", name: "Mel Member" });
    outsiderId = await testApp.createTestUser({
      email: "outsider@example.com",
      name: "Otto Outsider",
    });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** A public organization with an owner and a plain member. */
  async function seedPublicOrg(name = "Photosynthesis Lab") {
    const organizationId = await testApp.createOrganization(name, {
      visibility: "public",
      description: "We study leaves",
    });
    await testApp.addOrganizationMember(organizationId, ownerId, "owner");
    await testApp.addOrganizationMember(organizationId, memberId, "member");
    return organizationId;
  }

  async function seedPrivateOrg(name = "Secret Lab") {
    const organizationId = await testApp.createOrganization(name, { visibility: "private" });
    await testApp.addOrganizationMember(organizationId, ownerId, "owner");
    return organizationId;
  }

  describe("listOrganizations (directory)", () => {
    const path = () => testApp.resolveOrpcPath(contract.organizations.listOrganizations);

    it("lists public organizations with per-caller membership status", async () => {
      const publicOrg = await seedPublicOrg();

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body.total).toBe(1);
      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0]).toMatchObject({
        id: publicOrg,
        name: "Photosynthesis Lab",
        memberCount: 2,
        membershipStatus: "member",
      });
    });

    it("reports a pending request so the CTA can render 'Requested'", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.addOrganizationJoinRequest(publicOrg, outsiderId);

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations[0].membershipStatus).toBe("pending_request");
    });

    it("omits private organizations even from their own members", async () => {
      await seedPrivateOrg();

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations).toHaveLength(0);
    });

    it("omits personal workspaces even when they are somehow public", async () => {
      const personalOrgId = await testApp.personalOrganizationId(ownerId);
      await testApp.database.execute(
        `UPDATE organizations SET visibility = 'public' WHERE id = '${personalOrgId}'`,
      );

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations).toHaveLength(0);
    });

    it("filters by name and description", async () => {
      await seedPublicOrg("Photosynthesis Lab");
      const other = await testApp.createOrganization("Soil Institute", {
        visibility: "public",
        description: "We study drought",
      });
      await testApp.addOrganizationMember(other, ownerId, "owner");

      const byName: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(`${path()}?search=photo`)
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);
      expect(byName.body.organizations.map((o) => o.name)).toEqual(["Photosynthesis Lab"]);

      const byDescription: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(`${path()}?search=drought`)
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);
      expect(byDescription.body.organizations.map((o) => o.name)).toEqual(["Soil Institute"]);
    });

    it("pages with limit and offset while reporting the full total", async () => {
      for (const name of ["Alpha Org", "Beta Org", "Gamma Org"]) {
        await testApp.createOrganization(name, { visibility: "public" });
      }

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(`${path()}?limit=2&offset=1`)
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body.total).toBe(3);
      expect(response.body.organizations.map((o) => o.name)).toEqual(["Beta Org", "Gamma Org"]);
    });
  });

  describe("getOrganization (profile)", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.getOrganization, { id });

    it("serves a public organization to a non-member with their request state", async () => {
      const publicOrg = await seedPublicOrg();

      const response: SuperTestResponse<OrganizationProfile> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({
        id: publicOrg,
        role: null,
        membershipStatus: "none",
        memberCount: 2,
        visibility: "public",
      });
    });

    it("returns the caller's own role when they are a member", async () => {
      const publicOrg = await seedPublicOrg();

      const response: SuperTestResponse<OrganizationProfile> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.role).toBe("owner");
      expect(response.body.membershipStatus).toBe("member");
    });

    it("serves a private organization to its members", async () => {
      const privateOrg = await seedPrivateOrg();

      await testApp.get(path(privateOrg)).withAuth(ownerId).expect(StatusCodes.OK);
    });

    it("404s a private organization for a non-member rather than 403ing", async () => {
      const privateOrg = await seedPrivateOrg();

      await testApp.get(path(privateOrg)).withAuth(outsiderId).expect(StatusCodes.NOT_FOUND);
    });

    it("404s a personal workspace, even for its owner", async () => {
      const personalOrgId = await testApp.personalOrganizationId(ownerId);

      await testApp.get(path(personalOrgId)).withAuth(ownerId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listOrganizationResources", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listOrganizationResources, { id });

    /** Move a resource into the organization; the create helpers own personal orgs. */
    async function reassign(table: string, id: string, organizationId: string) {
      await testApp.database.execute(
        `UPDATE ${table} SET organization_id = '${organizationId}' WHERE id = '${id}'`,
      );
    }

    it("shows an outsider only the organization's public resources", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment: open } = await testApp.createExperiment({
        name: "Open experiment",
        userId: ownerId,
        visibility: "public",
      });
      const { experiment: closed } = await testApp.createExperiment({
        name: "Closed experiment",
        userId: ownerId,
        visibility: "private",
      });
      await reassign("experiments", open.id, publicOrg);
      await reassign("experiments", closed.id, publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body.resources.map((r) => r.name)).toEqual(["Open experiment"]);
    });

    it("shows a member everything the organization owns", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Closed experiment",
        userId: ownerId,
        visibility: "private",
      });
      await reassign("experiments", experiment.id, publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body.resources.map((r) => r.name)).toEqual(["Closed experiment"]);
    });

    it("never leaks another organization's resources", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.createExperiment({
        name: "Somewhere else",
        userId: ownerId,
        visibility: "public",
      });

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.resources).toHaveLength(0);
    });

    it("404s for a non-member of a private organization", async () => {
      const privateOrg = await seedPrivateOrg();

      await testApp.get(path(privateOrg)).withAuth(outsiderId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("getOrganizationDeletionBlockers", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.getOrganizationDeletionBlockers, { id });

    /** Move a resource into the organization; the create helpers own personal orgs. */
    async function reassign(table: string, id: string, organizationId: string) {
      await testApp.database.execute(
        `UPDATE ${table} SET organization_id = '${organizationId}' WHERE id = '${id}'`,
      );
    }

    it("reports an empty organization as deletable", async () => {
      const org = await seedPrivateOrg();

      const response: SuperTestResponse<OrganizationDeletionBlockers> = await testApp
        .get(path(org))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ blockers: [], total: 0 });
    });

    /**
     * The reason the showcase cannot serve this purpose: devices are absent from it
     * — they have no sharing surface — but the delete guard counts them, so an
     * organization owning only a device would otherwise look deletable.
     */
    it("counts devices, which the resources showcase never lists", async () => {
      const org = await seedPrivateOrg();
      const device = await testApp.createIotDevice({ createdBy: ownerId });
      await reassign("iot_devices", device.id, org);

      const showcase: SuperTestResponse<OrganizationResources> = await testApp
        .get(testApp.resolveOrpcPath(contract.organizations.listOrganizationResources, { id: org }))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(showcase.body.resources).toEqual([]);

      const response: SuperTestResponse<OrganizationDeletionBlockers> = await testApp
        .get(path(org))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        blockers: [{ resourceType: "device", count: 1 }],
        total: 1,
      });
    });

    it("counts every owned type, whatever the caller may read", async () => {
      const org = await seedPrivateOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Closed experiment",
        userId: ownerId,
        visibility: "private",
      });
      const device = await testApp.createIotDevice({ createdBy: ownerId });
      await reassign("experiments", experiment.id, org);
      await reassign("iot_devices", device.id, org);

      const response: SuperTestResponse<OrganizationDeletionBlockers> = await testApp
        .get(path(org))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.total).toBe(2);
      expect(response.body.blockers).toEqual(
        expect.arrayContaining([
          { resourceType: "experiment", count: 1 },
          { resourceType: "device", count: 1 },
        ]),
      );
    });

    it("answers not-found for a member who is not the owner", async () => {
      const org = await seedPublicOrg();

      // Deleting is owner-only, so the reason it is blocked is too — and a 403 here
      // would confirm the organization exists to somebody who cannot see it.
      await testApp.get(path(org)).withAuth(memberId).expect(StatusCodes.NOT_FOUND);
    });

    it("answers not-found for an outsider", async () => {
      const org = await seedPrivateOrg();

      await testApp.get(path(org)).withAuth(outsiderId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listOrganizationMembers", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listOrganizationMembers, { id });

    it("returns the roster with profile joins and roles", async () => {
      const publicOrg = await seedPublicOrg();

      const response: SuperTestResponse<OrganizationMembers> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body.members).toHaveLength(2);
      expect(response.body.members.map((m) => m.role).sort()).toEqual(["member", "owner"]);
      expect(response.body.members.map((m) => m.firstName).sort()).toEqual(["Mel", "Olive"]);
      expect(response.body.outsideCollaborators).toHaveLength(0);
    });

    it("derives outside collaborators from grants on the org's resources", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Shared experiment",
        userId: ownerId,
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${publicOrg}' WHERE id = '${experiment.id}'`,
      );
      await testApp.addExperimentCollaborator(experiment.id, outsiderId);
      // A member holding a grant is still a member, not an outside collaborator.
      await testApp.addExperimentCollaborator(experiment.id, memberId);

      const response: SuperTestResponse<OrganizationMembers> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.outsideCollaborators).toEqual([
        expect.objectContaining({ userId: outsiderId, resourceCount: 1 }),
      ]);
    });

    it("403s a non-member of a public organization", async () => {
      const publicOrg = await seedPublicOrg();

      await testApp.get(path(publicOrg)).withAuth(outsiderId).expect(StatusCodes.FORBIDDEN);
    });

    it("404s a non-member of a private organization", async () => {
      const privateOrg = await seedPrivateOrg();

      await testApp.get(path(privateOrg)).withAuth(outsiderId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listMyOrganizations", () => {
    const path = () => testApp.resolveOrpcPath(contract.organizations.listMyOrganizations);

    it("includes the personal workspace, flagged", async () => {
      const personalOrgId = await testApp.personalOrganizationId(ownerId);
      const publicOrg = await seedPublicOrg();

      const response: SuperTestResponse<MyOrganizationList> = await testApp
        .get(path())
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const byId = new Map(response.body.map((org) => [org.id, org]));
      expect(byId.get(personalOrgId)).toMatchObject({ isPersonal: true, role: "owner" });
      expect(byId.get(publicOrg)).toMatchObject({
        isPersonal: false,
        role: "owner",
        memberCount: 2,
      });
    });

    it("omits organizations the caller does not belong to", async () => {
      await seedPublicOrg();

      const response: SuperTestResponse<MyOrganizationList> = await testApp
        .get(path())
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(0);
    });
  });

  describe("the listings' owned-resource count", () => {
    /**
     * The count is a correlated subquery per owned table, and an unqualified column
     * inside one binds to the subquery's own table rather than the organization —
     * which comes back as a confident zero. Seeded across two tables so a sum that
     * only reached one of them fails here too.
     */
    async function seedOrgOwningTwoResources() {
      const organizationId = await seedPublicOrg();
      await testApp.createMacro({ name: "Leaf area", createdBy: ownerId, organizationId });
      const { experiment } = await testApp.createExperiment({
        name: "Owned experiment",
        userId: ownerId,
        visibility: "public",
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${organizationId}' WHERE id = '${experiment.id}'`,
      );
      return organizationId;
    }

    it("counts an organization's resources across every owned type in the directory", async () => {
      const organizationId = await seedOrgOwningTwoResources();

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(testApp.resolveOrpcPath(contract.organizations.listOrganizations))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations).toContainEqual(
        expect.objectContaining({ id: organizationId, resourceCount: 2 }),
      );
    });

    it("counts them the same way for the caller's own organizations", async () => {
      const organizationId = await seedOrgOwningTwoResources();

      const response: SuperTestResponse<MyOrganizationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.organizations.listMyOrganizations))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const byId = new Map(response.body.map((org) => [org.id, org]));
      expect(byId.get(organizationId)).toMatchObject({ resourceCount: 2 });
    });

    it("reports nothing owned as zero rather than omitting the organization", async () => {
      const organizationId = await seedPublicOrg();

      const response: SuperTestResponse<MyOrganizationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.organizations.listMyOrganizations))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const byId = new Map(response.body.map((org) => [org.id, org]));
      expect(byId.get(organizationId)).toMatchObject({ resourceCount: 0 });
    });
  });

  describe("listOrganizationTeams", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listOrganizationTeams, { id });

    it("returns teams with their members", async () => {
      const publicOrg = await seedPublicOrg();
      const teamId = await testApp.createTeam(publicOrg, "Field crew");
      await testApp.addTeamMember(teamId, memberId);

      const response: SuperTestResponse<OrganizationTeamList> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Field crew");
      expect(response.body[0].members.map((m) => m.userId)).toEqual([memberId]);
    });

    it("403s a non-member", async () => {
      const publicOrg = await seedPublicOrg();

      await testApp.get(path(publicOrg)).withAuth(outsiderId).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("listGranteeTeams", () => {
    const path = (resourceType: string, id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listGranteeTeams, { resourceType, id });

    it("offers the teams of the resource's owning organization", async () => {
      const publicOrg = await seedPublicOrg();
      const teamId = await testApp.createTeam(publicOrg, "Field crew");
      await testApp.addTeamMember(teamId, memberId);
      const { experiment } = await testApp.createExperiment({
        name: "Org experiment",
        userId: ownerId,
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${publicOrg}' WHERE id = '${experiment.id}'`,
      );

      const response: SuperTestResponse<GranteeTeamList> = await testApp
        .get(path("experiment", experiment.id))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([
        expect.objectContaining({ id: teamId, name: "Field crew", memberCount: 1 }),
      ]);
    });

    it("scopes to the organization the share decision was made against", async () => {
      const authorizedOrg = await seedPublicOrg();
      const authorizedTeam = await testApp.createTeam(authorizedOrg, "Authorized crew");
      // Where the resource has since moved to. Its teams must not surface.
      const otherOrg = await testApp.createOrganization("Elsewhere", { visibility: "public" });
      await testApp.createTeam(otherOrg, "Elsewhere crew");
      const { experiment } = await testApp.createExperiment({
        name: "Transferred experiment",
        userId: ownerId,
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${otherOrg}' WHERE id = '${experiment.id}'`,
      );

      const authz = testApp.module.get(AuthorizationService);
      vi.spyOn(authz, "can").mockResolvedValue({
        allow: true,
        reason: "org-role",
        role: "owner",
        organizationId: authorizedOrg,
      });

      const response: SuperTestResponse<GranteeTeamList> = await testApp
        .get(path("experiment", experiment.id))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.map((team) => team.id)).toEqual([authorizedTeam]);
    });

    it("404s a caller who cannot share the resource", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.createTeam(publicOrg, "Field crew");
      const { experiment } = await testApp.createExperiment({
        name: "Org experiment",
        userId: ownerId,
        visibility: "public",
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${publicOrg}' WHERE id = '${experiment.id}'`,
      );

      await testApp
        .get(path("experiment", experiment.id))
        .withAuth(outsiderId)
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
