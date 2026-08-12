import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  GranteeTeamList,
  MyOrganizationList,
  OrganizationDirectory,
  OrganizationMember,
  OrganizationMembers,
  OrganizationProfile,
  OrganizationDeletionBlockers,
  OrganizationResources,
  OrganizationTeamGrantList,
  OrganizationTeamList,
} from "@repo/api/domains/organization/organization.schema";
import { eq, organizationInvitations } from "@repo/database";

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

      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0]).toMatchObject({
        id: publicOrg,
        name: "Photosynthesis Lab",
        memberCount: 2,
        visibility: "public",
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

    it("includes a private organization the caller belongs to, flagged private", async () => {
      // "All organizations" means all the ones you can see: a private organization you
      // are a member of is not a secret from you. It has to say it is private, though,
      // or the card renders it as public.
      const privateOrg = await seedPrivateOrg();

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations).toHaveLength(1);
      expect(response.body.organizations[0]).toMatchObject({
        id: privateOrg,
        visibility: "private",
        membershipStatus: "member",
      });
    });

    it("omits a private organization the caller does not belong to", async () => {
      // The other half of the boundary, and the half that matters: widening the
      // directory to a member's own private organizations must not widen it further.
      await seedPrivateOrg();

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(outsiderId)
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

    it("returns every matching organization, unpaged", async () => {
      // This is the only listing of organizations there is, so it shows all of them.
      for (const name of ["Alpha Org", "Beta Org", "Gamma Org"]) {
        await testApp.createOrganization(name, { visibility: "public" });
      }

      const response: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(path())
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body.organizations.map((o) => o.name)).toEqual([
        "Alpha Org",
        "Beta Org",
        "Gamma Org",
      ]);
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

    it("carries the whole estate and the creation date, whatever the caller may read", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Closed experiment",
        userId: ownerId,
        visibility: "private",
      });
      const device = await testApp.createIotDevice({ createdBy: ownerId });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${publicOrg}' WHERE id = '${experiment.id}'`,
      );
      await testApp.database.execute(
        `UPDATE iot_devices SET organization_id = '${publicOrg}' WHERE id = '${device.id}'`,
      );

      // The outsider is the interesting caller: the count is a fact about the
      // organization, so it must not shrink to what they happen to be able to open.
      const response: SuperTestResponse<OrganizationProfile> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(response.body.resourceCount).toBe(2);
      expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false);
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

    it("carries the meta worth showing per type, and nothing another type's", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Drought stress",
        userId: ownerId,
        visibility: "public",
      });
      const protocol = await testApp.createProtocol({
        name: "MultispeQ field run",
        createdBy: ownerId,
        family: "minipar",
        organizationId: publicOrg,
      });
      const macro = await testApp.createMacro({
        name: "Fv/Fm correction",
        createdBy: ownerId,
        language: "r",
        organizationId: publicOrg,
      });
      const workbook = await testApp.createWorkbook({
        name: "Canopy synthesis",
        createdBy: ownerId,
        organizationId: publicOrg,
      });
      await reassign("experiments", experiment.id, publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const byId = new Map(response.body.resources.map((row) => [row.id, row]));

      expect(byId.get(experiment.id)).toMatchObject({ type: "experiment", status: "active" });
      expect(byId.get(protocol.id)).toMatchObject({ type: "protocol", family: "minipar" });
      expect(byId.get(macro.id)).toMatchObject({ type: "macro", language: "r" });
      // A workbook's row has no meta of its own, and no other type's either.
      expect(Object.keys(byId.get(workbook.id) ?? {}).sort()).toEqual([
        "description",
        "id",
        "name",
        "type",
        "updatedAt",
        "visibility",
      ]);
    });

    /**
     * **The showcase invariant.** `totals[type]` equals the number of returned rows of
     * that type, for every type and for every caller.
     *
     * `totals` is a second computation of a number the rows also carry, which is the
     * seam that produced the original defect: `findAll` hid archived experiments while
     * every count of what an organization owns included them, so both sides were
     * internally consistent and disagreed only across the join. Asserting the agreement
     * — rather than either number — is what catches the next filter added to one side.
     *
     * Exercised for a member who can see everything **and** an outsider who cannot, so
     * it cannot pass merely because both sides happen to be unscoped.
     */
    async function seedOneOfEveryType(organizationId: string) {
      const { experiment: live } = await testApp.createExperiment({
        name: "Running campaign",
        userId: ownerId,
        visibility: "public",
      });
      const { experiment: archived } = await testApp.createExperiment({
        name: "Greenhouse calibration 2024",
        userId: ownerId,
        visibility: "private",
      });
      await reassign("experiments", live.id, organizationId);
      await reassign("experiments", archived.id, organizationId);
      await testApp.database.execute(
        `UPDATE experiments SET status = 'archived' WHERE id = '${archived.id}'`,
      );

      await testApp.createProtocol({
        name: "Dark adaptation",
        createdBy: ownerId,
        organizationId,
      });
      await testApp.createMacro({ name: "Batch fit", createdBy: ownerId, organizationId });
      await testApp.createWorkbook({ name: "Synthesis", createdBy: ownerId, organizationId });

      return { live, archived };
    }

    /** Rows of each type, keyed the same way `totals` is. */
    function rowsPerType(body: OrganizationResources) {
      return {
        experiment: body.resources.filter((row) => row.type === "experiment").length,
        protocol: body.resources.filter((row) => row.type === "protocol").length,
        macro: body.resources.filter((row) => row.type === "macro").length,
        workbook: body.resources.filter((row) => row.type === "workbook").length,
      };
    }

    it("holds the totals-equal-rows invariant for a member, archived included", async () => {
      const publicOrg = await seedPublicOrg();
      const { archived } = await seedOneOfEveryType(publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(rowsPerType(response.body)).toEqual(response.body.totals);
      // Not vacuous: a member sees both experiments, the archived one among them.
      expect(response.body.totals).toEqual({
        experiment: 2,
        protocol: 1,
        macro: 1,
        workbook: 1,
      });
      // The archived row carries its status, which is the only surface that shows it.
      expect(response.body.resources.find((row) => row.id === archived.id)).toMatchObject({
        type: "experiment",
        status: "archived",
        visibility: "private",
      });
    });

    it("holds the same invariant for an outsider, who sees strictly less", async () => {
      const publicOrg = await seedPublicOrg();
      await seedOneOfEveryType(publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(rowsPerType(response.body)).toEqual(response.body.totals);
      // The private archived experiment is behind neither the rows nor the count, so
      // the invariant is holding on a genuinely narrower set rather than on the same one.
      expect(response.body.totals.experiment).toBe(1);
    });

    it("still hides archived experiments from the experiments listing", async () => {
      // The opt-in must not have changed the default: the listing deliberately hides
      // archived, and this is the assertion that stops the fix leaking into it.
      const { experiment: live } = await testApp.createExperiment({
        name: "Running campaign",
        userId: ownerId,
      });
      const { experiment: archived } = await testApp.createExperiment({
        name: "Greenhouse calibration 2024",
        userId: ownerId,
      });
      await testApp.database.execute(
        `UPDATE experiments SET status = 'archived' WHERE id = '${archived.id}'`,
      );

      const listing: SuperTestResponse<{ id: string }[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.listExperiments))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const ids = listing.body.map((row) => row.id);
      // The live row proves the listing reaches these experiments at all, so the
      // exclusion below cannot pass by the listing being empty for another reason.
      expect(ids).toContain(live.id);
      expect(ids).not.toContain(archived.id);
    });

    it("totals what the caller may read, per type, past the row cap", async () => {
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
      await testApp.createProtocol({
        name: "Dark adaptation",
        createdBy: ownerId,
        organizationId: publicOrg,
      });

      const asMember: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);
      const asOutsider: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      expect(asMember.body.totals).toEqual({
        experiment: 2,
        protocol: 1,
        macro: 0,
        workbook: 0,
      });
      // Scoped exactly like the rows: the private experiment is behind neither.
      expect(asOutsider.body.totals.experiment).toBe(1);
      expect(asOutsider.body.resources).toHaveLength(2);
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
    });

    it("carries nothing but the roster — a grant holder is not a roster row", async () => {
      const publicOrg = await seedPublicOrg();
      const { experiment } = await testApp.createExperiment({
        name: "Shared experiment",
        userId: ownerId,
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${publicOrg}' WHERE id = '${experiment.id}'`,
      );
      await testApp.addExperimentCollaborator(experiment.id, outsiderId);

      const response: SuperTestResponse<OrganizationMembers> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(Object.keys(response.body)).toEqual(["members"]);
      expect(response.body.members.map((m) => m.userId)).not.toContain(outsiderId);
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

  describe("addOrganizationMember", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.addOrganizationMember, { id });

    let adminId: string;

    beforeEach(async () => {
      adminId = await testApp.createTestUser({ email: "admin@example.com", name: "Adam Admin" });
    });

    /** A public organization staffed with an owner, an admin and a plain member. */
    async function seedStaffedOrg() {
      const organizationId = await seedPublicOrg();
      await testApp.addOrganizationMember(organizationId, adminId, "admin");
      return organizationId;
    }

    it("admits a registered user straight onto the roster, with no invitation", async () => {
      const organizationId = await seedStaffedOrg();

      const response: SuperTestResponse<OrganizationMember> = await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: outsiderId, role: "admin" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        userId: outsiderId,
        firstName: "Otto",
        lastName: "Outsider",
        role: "admin",
      });

      const roster: SuperTestResponse<OrganizationMembers> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.organizations.listOrganizationMembers, {
            id: organizationId,
          }),
        )
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(roster.body.members.map((member) => member.userId)).toContain(outsiderId);

      // Instant means instant: nothing is left pending for the new member to accept.
      const invitations = await testApp.database
        .select({ id: organizationInvitations.id })
        .from(organizationInvitations)
        .where(eq(organizationInvitations.organizationId, organizationId));
      expect(invitations).toHaveLength(0);
    });

    it("defaults the role to member", async () => {
      const organizationId = await seedStaffedOrg();

      const response: SuperTestResponse<OrganizationMember> = await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: outsiderId })
        .expect(StatusCodes.CREATED);

      expect(response.body.role).toBe("member");
    });

    it("lets an admin admit members and admins", async () => {
      const organizationId = await seedStaffedOrg();
      const otherId = await testApp.createTestUser({
        email: "other@example.com",
        name: "Ola Other",
      });

      await testApp
        .post(path(organizationId))
        .withAuth(adminId)
        .send({ userId: outsiderId, role: "member" })
        .expect(StatusCodes.CREATED);
      await testApp
        .post(path(organizationId))
        .withAuth(adminId)
        .send({ userId: otherId, role: "admin" })
        .expect(StatusCodes.CREATED);
    });

    it("refuses an admin handing out the owner role", async () => {
      const organizationId = await seedStaffedOrg();

      // Nobody hands out more than they hold — the same bound Better Auth puts on
      // an invitation, restated because this write never reaches Better Auth.
      await testApp
        .post(path(organizationId))
        .withAuth(adminId)
        .send({ userId: outsiderId, role: "owner" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("lets an owner hand out the owner role", async () => {
      const organizationId = await seedStaffedOrg();

      const response: SuperTestResponse<OrganizationMember> = await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: outsiderId, role: "owner" })
        .expect(StatusCodes.CREATED);

      expect(response.body.role).toBe("owner");
    });

    it("403s a plain member of the organization", async () => {
      const organizationId = await seedStaffedOrg();

      await testApp
        .post(path(organizationId))
        .withAuth(memberId)
        .send({ userId: outsiderId, role: "member" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("403s a non-member of a public organization and 404s one of a private organization", async () => {
      const publicOrg = await seedStaffedOrg();
      const privateOrg = await seedPrivateOrg();
      const targetId = await testApp.createTestUser({
        email: "target@example.com",
        name: "Tia Target",
      });

      await testApp
        .post(path(publicOrg))
        .withAuth(outsiderId)
        .send({ userId: targetId, role: "member" })
        .expect(StatusCodes.FORBIDDEN);
      // A private organization cannot even confirm it exists.
      await testApp
        .post(path(privateOrg))
        .withAuth(outsiderId)
        .send({ userId: targetId, role: "member" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("409s somebody who is already on the roster", async () => {
      const organizationId = await seedStaffedOrg();

      await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: memberId, role: "admin" })
        .expect(StatusCodes.CONFLICT);

      // And their existing role is untouched by the attempt.
      const roster: SuperTestResponse<OrganizationMembers> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.organizations.listOrganizationMembers, {
            id: organizationId,
          }),
        )
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(roster.body.members.find((member) => member.userId === memberId)?.role).toBe("member");
    });

    it("refuses a personal workspace", async () => {
      const personalOrgId = await testApp.personalOrganizationId(ownerId);

      // Personal workspaces have no roster to add to, and the whole organization
      // surface answers not-found for them rather than refusing.
      await testApp
        .post(path(personalOrgId))
        .withAuth(ownerId)
        .send({ userId: outsiderId, role: "member" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("refuses a user id no discoverable account stands behind", async () => {
      const organizationId = await seedStaffedOrg();
      const deactivatedId = await testApp.createTestUser({
        email: "dormant@example.com",
        name: "Dora Dormant",
        activated: false,
      });
      const closedId = await testApp.createTestUser({
        email: "closed@example.com",
        name: "Cleo Closed",
        deletedAt: new Date(),
      });

      // The same set of people the user search offers: an account that never
      // finished onboarding or has closed is offered by neither.
      await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: deactivatedId, role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
      await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: closedId, role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
      await testApp
        .post(path(organizationId))
        .withAuth(ownerId)
        .send({ userId: faker.string.uuid(), role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
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

  describe("listOrganizationTeamGrants", () => {
    const path = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listOrganizationTeamGrants, { id });

    it("reports what each team reaches, across every grantable type", async () => {
      const publicOrg = await seedPublicOrg();
      const fieldCrew = await testApp.createTeam(publicOrg, "Field crew");
      const analysts = await testApp.createTeam(publicOrg, "Analysts");
      const { experiment } = await testApp.createExperiment({
        name: "Canopy series",
        userId: ownerId,
      });
      const device = await testApp.createIotDevice({ createdBy: ownerId, name: "Node 4" });

      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: fieldCrew,
        role: "admin",
      });
      // A device grant counts too: deleting the team withdraws it like any other.
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: device.id,
        granteeType: "team",
        granteeId: analysts,
        role: "viewer",
      });

      const response: SuperTestResponse<OrganizationTeamGrantList> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            teamId: fieldCrew,
            resourceType: "experiment",
            resourceId: experiment.id,
            resourceName: "Canopy series",
            role: "admin",
          }),
          expect.objectContaining({
            teamId: analysts,
            resourceType: "device",
            resourceName: "Node 4",
            role: "viewer",
          }),
        ]),
      );
      expect(response.body).toHaveLength(2);
    });

    it("names a nameless device by its thing name rather than dropping the row", async () => {
      const publicOrg = await seedPublicOrg();
      const analysts = await testApp.createTeam(publicOrg, "Analysts");
      // `iot_devices.name` is nullable. The row still has to reach the client, or the
      // team-card count would disagree with the table under it — and because the read
      // inner-joins the resource, a blank name means unnamed and never "gone", so the
      // fallback is another identifier rather than a placeholder.
      const device = await testApp.createIotDevice({ createdBy: ownerId, name: null });
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: device.id,
        granteeType: "team",
        granteeId: analysts,
        role: "viewer",
      });

      const response: SuperTestResponse<OrganizationTeamGrantList> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([
        expect.objectContaining({ resourceType: "device", resourceName: device.thingName }),
      ]);
    });

    it("ignores grants to users and to other organizations' teams", async () => {
      const publicOrg = await seedPublicOrg();
      const elsewhere = await testApp.createOrganization("Elsewhere", { visibility: "public" });
      const otherTeam = await testApp.createTeam(elsewhere, "Elsewhere crew");
      const { experiment } = await testApp.createExperiment({
        name: "Canopy series",
        userId: ownerId,
      });
      await testApp.addExperimentCollaborator(experiment.id, memberId);
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: otherTeam,
        role: "viewer",
      });

      const response: SuperTestResponse<OrganizationTeamGrantList> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("403s a non-member of a public organization and 404s one of a private organization", async () => {
      const publicOrg = await seedPublicOrg();
      const privateOrg = await seedPrivateOrg();

      await testApp.get(path(publicOrg)).withAuth(outsiderId).expect(StatusCodes.FORBIDDEN);
      await testApp.get(path(privateOrg)).withAuth(outsiderId).expect(StatusCodes.NOT_FOUND);
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
