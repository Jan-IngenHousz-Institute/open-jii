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
  OrganizationTeamGrantList,
  OrganizationTeamList,
} from "@repo/api/domains/organization/organization.schema";
import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { assertSuccess } from "../../common/utils/fp-utils";
import { CreateIotDeviceGroupUseCase } from "../../iot/application/use-cases/create-iot-device-group/create-iot-device-group";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { OrganizationRepository } from "../core/repositories/organization.repository";

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

    /**
     * This asserted the opposite until the count was scoped — "the whole estate,
     * whatever the caller may read", on the reasoning that a size is a fact about the
     * organization and should not shrink per reader.
     *
     * Reversed deliberately. The number is rendered on a card as "how much of this is
     * here for me", and every other count on the surface is access-scoped, so the
     * unscoped one promised a visitor resources that then were not there — off by
     * exactly the private estate. Reporting a different size to different readers is
     * the accepted cost; the previous behaviour was wrong for everyone outside.
     */
    it("counts only what the caller may read, and carries the creation date", async () => {
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

      const asOutsider: SuperTestResponse<OrganizationProfile> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);
      const asMember: SuperTestResponse<OrganizationProfile> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      // The outsider is the interesting caller: a private experiment and a device that
      // can never be public are both invisible to them, so there is nothing to count.
      expect(asOutsider.body.resourceCount).toBe(0);
      // And not simply broken — a member of the same organization counts both.
      expect(asMember.body.resourceCount).toBe(2);
      expect(Number.isNaN(Date.parse(asOutsider.body.createdAt))).toBe(false);
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
        "collaboratorCount",
        "description",
        "id",
        "name",
        "type",
        "updatedAt",
        "visibility",
      ]);
    });

    /**
     * Asserted on the wire rather than on the use-case result: the field has to survive
     * the contract's response validation and the controller's date formatting, and a
     * base-schema field dropped from either would still read fine one layer down.
     */
    it("carries a collaborator count on every type, agreeing with the collaborators list", async () => {
      const publicOrg = await seedPublicOrg();
      const outsider2 = await testApp.createTestUser({ email: "o2@example.com", name: "O Two" });
      const { experiment } = await testApp.createExperiment({
        name: "Drought stress",
        userId: ownerId,
        visibility: "public",
      });
      await reassign("experiments", experiment.id, publicOrg);
      const workbook = await testApp.createWorkbook({
        name: "Canopy synthesis",
        createdBy: ownerId,
        organizationId: publicOrg,
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: outsider2,
        role: "viewer",
        createdBy: ownerId,
      });

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);

      const byId = new Map(response.body.resources.map((row) => [row.id, row]));
      // The organization's owner and the summary standing in for its one plain
      // member, plus the granted outsider on the experiment.
      expect(byId.get(experiment.id)?.collaboratorCount).toBe(3);
      expect(byId.get(workbook.id)?.collaboratorCount).toBe(2);

      // The number the card would show, against the tab it links to.
      const collaborators = await testApp
        .get(
          testApp.resolveOrpcPath(contract.sharing.listGrants, {
            resourceType: "experiment",
            id: experiment.id,
          }),
        )
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(byId.get(experiment.id)?.collaboratorCount).toBe(
        (collaborators.body as unknown[]).length,
      );
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
      await testApp.createIotDevice({ createdBy: ownerId, organizationId });
      const group = await testApp.module
        .get(CreateIotDeviceGroupUseCase)
        .execute({ name: "Rooftop array", organizationId }, ownerId);
      assertSuccess(group);

      return { live, archived };
    }

    /**
     * Rows of each owned type, keyed the same way `totals` is. Built from the grant enum
     * rather than written out, so a newly owned type joins this invariant by existing —
     * a hand-keyed object would leave that type's rows and its total free to disagree
     * while every assertion here stayed green.
     *
     * There was briefly a `showcaseTotals()` helper here that destructured `device` out,
     * because devices were counted and never listed. They are listed now, so the
     * exemption is gone and the invariant covers every type it counts. An exemption is
     * exactly where the two sides drift.
     */
    function rowsPerType(body: OrganizationResources): Record<string, number> {
      return Object.fromEntries(
        zSharingResourceType.options.map((type) => [
          type,
          body.resources.filter((row) => row.type === type).length,
        ]),
      );
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
        device: 1,
        device_group: 1,
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
        device: 0,
        device_group: 0,
      });
      // Scoped exactly like the rows: the private experiment is behind neither.
      expect(asOutsider.body.totals.experiment).toBe(1);
      expect(asOutsider.body.resources).toHaveLength(2);
    });

    /**
     * This asserted the opposite — that devices are counted and never listed. They were,
     * briefly, and it showed as a Devices segment on the estate bar with no Devices
     * group in the list beneath it. A member reaches the organization's devices through
     * the same owning-org arm that gets them every other private resource, so a device
     * is a resource they can see and the card that lists what the organization owns
     * lists it.
     */
    it("lists an organization's devices as well as counting them", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.createIotDevice({ createdBy: ownerId, organizationId: publicOrg });
      await testApp.createIotDevice({ createdBy: ownerId, organizationId: publicOrg });
      await testApp.createWorkbook({
        name: "Synthesis",
        createdBy: ownerId,
        organizationId: publicOrg,
      });

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      expect(response.body.totals.device).toBe(2);
      // Two device rows to go with the count of two, alongside the workbook.
      expect(response.body.resources.filter((row) => row.type === "device")).toHaveLength(2);
      expect(response.body.totals.workbook).toBe(1);
    });

    it("lists a member's devices as rows, and falls back to the thing name", async () => {
      const publicOrg = await seedPublicOrg();
      const named = await testApp.createIotDevice({
        createdBy: ownerId,
        organizationId: publicOrg,
        name: "Canopy MultispeQ 01",
        deviceType: "multispeq",
      });
      // `name` is nullable and `thing_name` is not, so an unnamed device still has
      // something to render — deliberately another identifier, not a placeholder.
      const nameless = await testApp.createIotDevice({
        createdBy: ownerId,
        organizationId: publicOrg,
        name: null,
        thingName: "orgseed-canopy-ambyte-01",
        deviceType: "ambyte",
      });

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);

      const devices = response.body.resources.filter((row) => row.type === "device");
      expect(devices).toHaveLength(2);
      expect(devices.find((row) => row.id === named.id)).toMatchObject({
        type: "device",
        name: "Canopy MultispeQ 01",
        deviceType: "multispeq",
        // No `description` column on the table, so the field is structurally null.
        description: null,
      });
      expect(devices.find((row) => row.id === nameless.id)?.name).toBe("orgseed-canopy-ambyte-01");
    });

    /**
     * A creator since removed from the owning organization. This case used to separate
     * the device read from every other type's: an authorship arm listed the device while
     * `accessibleResourceCondition` — which the totals use — denied it. The arm is gone,
     * so rows and count now narrow together here like everywhere else, and this is the
     * test that would catch it coming back.
     */
    it("does not list a device to its creator once they have left the organization", async () => {
      const publicOrg = await seedPublicOrg();
      const leaver = await testApp.createTestUser({
        email: "leaver@example.com",
        name: "Lee Leaver",
      });
      await testApp.addOrganizationMember(publicOrg, leaver, "member");
      await testApp.createIotDevice({ createdBy: leaver, organizationId: publicOrg });

      const whileMember: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(leaver)
        .expect(StatusCodes.OK);
      expect(whileMember.body.resources.filter((row) => row.type === "device")).toHaveLength(1);
      expect(whileMember.body.totals.device).toBe(1);

      await testApp.database.execute(
        `DELETE FROM organization_members WHERE organization_id = '${publicOrg}' AND user_id = '${leaver}'`,
      );

      const afterLeaving: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(leaver)
        .expect(StatusCodes.OK);

      // Rows and count agree on zero, which is the whole property.
      expect(afterLeaving.body.resources.filter((row) => row.type === "device")).toHaveLength(0);
      expect(afterLeaving.body.totals.device).toBe(0);
    });

    it("shows an outsider no device rows while still showing the public groups", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.createIotDevice({ createdBy: ownerId, organizationId: publicOrg });
      const { experiment: open } = await testApp.createExperiment({
        name: "Open experiment",
        userId: ownerId,
        visibility: "public",
      });
      await reassign("experiments", open.id, publicOrg);

      const response: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      // A visitor gets fewer groups and fewer segments than a member does — the rows
      // and the counts narrow together.
      expect(response.body.resources.map((row) => row.type)).toEqual(["experiment"]);
      expect(response.body.totals.device).toBe(0);
    });

    it("shows a non-member no devices, since a device can never be public", async () => {
      const publicOrg = await seedPublicOrg();
      await testApp.createIotDevice({ createdBy: ownerId, organizationId: publicOrg });
      const { experiment: open } = await testApp.createExperiment({
        name: "Open experiment",
        userId: ownerId,
        visibility: "public",
      });
      await reassign("experiments", open.id, publicOrg);

      const asMember: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(memberId)
        .expect(StatusCodes.OK);
      const asOutsider: SuperTestResponse<OrganizationResources> = await testApp
        .get(path(publicOrg))
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);

      // `zPublishableResourceType` excludes devices, so nothing can publish one and the
      // shared predicate's public arm is unreachable for them. A member counts it
      // through their membership; an outsider has no arm left that could.
      expect(asMember.body.totals.device).toBe(1);
      expect(asOutsider.body.totals.device).toBe(0);
      // Not vacuous — the outsider does reach this organization and sees its public work.
      expect(asOutsider.body.totals.experiment).toBe(1);
    });
  });

  /**
   * **The count agreement.** Every surface that says how big an organization is has to
   * say the same thing to the same caller.
   *
   * This is the invariant that was broken: `resourceCount` was a bare `COUNT(*)` while
   * the per-type totals were access-scoped, so a visitor read 43 on the directory card
   * and 3 in the mix header one click later — off by exactly the private estate. Both
   * now build from one SQL fragment, and this pins the consequence rather than the
   * implementation, so it holds however either side is rewritten.
   */
  describe("resourceCount agrees with the per-type totals", () => {
    const profilePath = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.getOrganization, { id });
    const resourcesPath = (id: string) =>
      testApp.resolveOrpcPath(contract.organizations.listOrganizationResources, { id });
    const directoryPath = () => testApp.resolveOrpcPath(contract.organizations.listOrganizations);

    /**
     * One public organization holding four things: a public experiment anyone may read,
     * two private experiments, and a private device. Four callers will each see a
     * different number of them.
     */
    async function seedMixedEstate(organizationId: string) {
      const { experiment: open } = await testApp.createExperiment({
        name: "Open experiment",
        userId: ownerId,
        visibility: "public",
      });
      const { experiment: shared } = await testApp.createExperiment({
        name: "Shared experiment",
        userId: ownerId,
        visibility: "private",
      });
      const { experiment: closed } = await testApp.createExperiment({
        name: "Closed experiment",
        userId: ownerId,
        visibility: "private",
      });
      await testApp.database.execute(
        `UPDATE experiments SET organization_id = '${organizationId}'
         WHERE id IN ('${open.id}', '${shared.id}', '${closed.id}')`,
      );
      await testApp.createIotDevice({ createdBy: ownerId, organizationId });
      return { shared };
    }

    /** The profile's single number and the showcase's per-type breakdown, for one caller. */
    async function countsFor(organizationId: string, userId: string) {
      const profile: SuperTestResponse<OrganizationProfile> = await testApp
        .get(profilePath(organizationId))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      const resources: SuperTestResponse<OrganizationResources> = await testApp
        .get(resourcesPath(organizationId))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      const totalsSum = Object.values(resources.body.totals).reduce((sum, n) => sum + n, 0);
      return { resourceCount: profile.body.resourceCount, totalsSum };
    }

    it("agrees for a member, who can read the whole estate", async () => {
      const publicOrg = await seedPublicOrg();
      await seedMixedEstate(publicOrg);

      const { resourceCount, totalsSum } = await countsFor(publicOrg, memberId);

      expect(resourceCount).toBe(totalsSum);
      // Not vacuous: three experiments and a device, all reachable through membership.
      expect(resourceCount).toBe(4);
    });

    it("agrees for an outsider, who can read one of the four", async () => {
      const publicOrg = await seedPublicOrg();
      await seedMixedEstate(publicOrg);

      const { resourceCount, totalsSum } = await countsFor(publicOrg, outsiderId);

      expect(resourceCount).toBe(totalsSum);
      // The number that used to be 4 here, promising three resources this caller
      // cannot open — the two private experiments and the device.
      expect(resourceCount).toBe(1);
    });

    it("agrees for an outsider holding a grant, who can read two", async () => {
      const publicOrg = await seedPublicOrg();
      const { shared } = await seedMixedEstate(publicOrg);
      const grantee = await testApp.createTestUser({
        email: "grantee@example.com",
        name: "Gina Grantee",
      });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: shared.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
        createdBy: ownerId,
      });

      const { resourceCount, totalsSum } = await countsFor(publicOrg, grantee);

      expect(resourceCount).toBe(totalsSum);
      // The public one plus the one shared with them — a grant is a read tier, so it
      // has to lift the count as well as the rows.
      expect(resourceCount).toBe(2);
    });

    it("reports the same scoped number on the directory card as on the profile", async () => {
      const publicOrg = await seedPublicOrg();
      await seedMixedEstate(publicOrg);

      const directory: SuperTestResponse<OrganizationDirectory> = await testApp
        .get(directoryPath())
        .withAuth(outsiderId)
        .expect(StatusCodes.OK);
      const card = directory.body.organizations.find((row) => row.id === publicOrg);

      const { resourceCount } = await countsFor(publicOrg, outsiderId);
      // The card is what a visitor reads before clicking, so it is the surface the old
      // number was most wrong on.
      expect(card?.resourceCount).toBe(resourceCount);
      expect(card?.resourceCount).toBe(1);
    });

    /**
     * The no-caller arm, which no route can reach — every organization endpoint takes a
     * session — but the join-request email paths hit `findProfileFields` with no viewer,
     * so the predicate has to collapse to public-only rather than throw or count
     * everything. Exercised on the repository because there is no HTTP surface for it.
     */
    it("collapses to public-only when there is no caller at all", async () => {
      const publicOrg = await seedPublicOrg();
      await seedMixedEstate(publicOrg);
      const repository = testApp.module.get(OrganizationRepository);

      const anonymous = await repository.findProfileFields(publicOrg, undefined);
      assertSuccess(anonymous);
      const asOwner = await repository.findProfileFields(publicOrg, ownerId);
      assertSuccess(asOwner);

      expect(anonymous.value?.resourceCount).toBe(1);
      // Not a constant: the same read with a member counts all four.
      expect(asOwner.value?.resourceCount).toBe(4);
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
     * The reason the showcase cannot serve this purpose. It used to be that devices were
     * absent from the showcase entirely; they are listed there now, so the remaining —
     * and load-bearing — difference is scoping: the showcase counts what *this caller*
     * may read, while the delete guard counts the organization's whole estate. An owner
     * sees the same number from both, which is why the sibling test below exercises the
     * unscoped path with resources the caller cannot read.
     */
    it("counts a device that the showcase shows this caller too", async () => {
      const org = await seedPrivateOrg();
      const device = await testApp.createIotDevice({ createdBy: ownerId });
      await reassign("iot_devices", device.id, org);

      const showcase: SuperTestResponse<OrganizationResources> = await testApp
        .get(testApp.resolveOrpcPath(contract.organizations.listOrganizationResources, { id: org }))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(showcase.body.resources.map((row) => row.type)).toEqual(["device"]);

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
