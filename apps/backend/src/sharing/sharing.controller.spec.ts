import { StatusCodes } from "http-status-codes";

import { TestHarness } from "../test/test-harness";

describe("SharingController", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** An experiment owned by an org in which `owner` is an admin (so can share). */
  async function ownedExperiment() {
    const owner = await testApp.createTestUser();
    const org = await testApp.createOrganization();
    await testApp.addOrgMember(org.id, owner, "admin");
    const { experiment } = await testApp.createExperiment({
      name: `Share ${crypto.randomUUID().slice(0, 8)}`,
      userId: owner,
      visibility: "private",
      organizationId: org.id,
    });
    return { owner, org, experiment };
  }

  const grantsUrl = (id: string) => `/api/v1/resources/experiment/${id}/grants`;
  const accessUrl = (id: string) => `/api/v1/resources/experiment/${id}/access`;

  describe("getResourceAccess", () => {
    it("reports full permissions for an org admin", async () => {
      const { owner, experiment } = await ownedExperiment();
      const res = await testApp
        .get(accessUrl(experiment.id))
        .withAuth(owner)
        .expect(StatusCodes.OK);
      expect(res.body).toEqual({
        canRead: true,
        canUpdate: true,
        canDelete: true,
        canShare: true,
      });
    });

    it("reports no permissions for a stranger on a private resource", async () => {
      const { experiment } = await ownedExperiment();
      const stranger = await testApp.createTestUser();
      const res = await testApp
        .get(accessUrl(experiment.id))
        .withAuth(stranger)
        .expect(StatusCodes.OK);
      expect(res.body).toEqual({
        canRead: false,
        canUpdate: false,
        canDelete: false,
        canShare: false,
      });
    });
  });

  describe("listResourceGrants", () => {
    it("returns grants for a user who can read the resource", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp.get(grantsUrl(experiment.id)).withAuth(owner).expect(StatusCodes.OK);
    });

    it("404 when the resource does not exist", async () => {
      const user = await testApp.createTestUser();
      await testApp
        .get(grantsUrl(crypto.randomUUID()))
        .withAuth(user)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("403 for a user with no access to a private resource", async () => {
      const { experiment } = await ownedExperiment();
      const stranger = await testApp.createTestUser();
      await testApp.get(grantsUrl(experiment.id)).withAuth(stranger).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("createResourceGrant", () => {
    it("shares the resource with a user (201) and lists it", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();

      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.CREATED);

      const list = await testApp
        .get(grantsUrl(experiment.id))
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const grants = list.body as { granteeId: string; role: string }[];
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({ granteeId: grantee, role: "member" });
    });

    it("409 on a duplicate grant", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();
      const payload = { granteeType: "user", granteeId: grantee, role: "member" };
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send(payload)
        .expect(StatusCodes.CREATED);
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send(payload)
        .expect(StatusCodes.CONFLICT);
    });

    it("400 when the grantee does not exist", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: crypto.randomUUID(), role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("403 when the actor cannot share the resource", async () => {
      const { experiment } = await ownedExperiment();
      const stranger = await testApp.createTestUser();
      const grantee = await testApp.createTestUser();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(stranger)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("shares with an organization grantee (201)", async () => {
      const { owner, experiment } = await ownedExperiment();
      const otherOrg = await testApp.createOrganization();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "organization", granteeId: otherOrg.id, role: "member" })
        .expect(StatusCodes.CREATED);
    });

    it("400 for a non-existent organization grantee", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "organization", granteeId: crypto.randomUUID(), role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("shares with a team grantee (201)", async () => {
      const { owner, experiment } = await ownedExperiment();
      const team = await testApp.createTeam((await testApp.createOrganization()).id, "Imaging");
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: team.id, role: "member" })
        .expect(StatusCodes.CREATED);
    });

    it("400 for a non-existent team grantee", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "team", granteeId: crypto.randomUUID(), role: "member" })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("listResourceGrants grantee identity", () => {
    it("enriches a user grant with the grantee's display info", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.CREATED);

      const list = await testApp
        .get(grantsUrl(experiment.id))
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const grants = list.body as {
        granteeId: string;
        grantee: { type: string; email: string | null };
      }[];
      expect(grants[0].grantee.type).toBe("user");
      expect(grants[0].grantee.email).toBeTruthy();
    });

    it("enriches an organization grant with the org name", async () => {
      const { owner, experiment } = await ownedExperiment();
      const otherOrg = await testApp.createOrganization({ name: "Field Trials Group" });
      await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "organization", granteeId: otherOrg.id, role: "member" })
        .expect(StatusCodes.CREATED);

      const list = await testApp
        .get(grantsUrl(experiment.id))
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const grants = list.body as { grantee: { type: string; displayName: string | null } }[];
      expect(grants[0].grantee).toMatchObject({
        type: "organization",
        displayName: "Field Trials Group",
      });
    });
  });

  describe("updateResourceGrant", () => {
    const updateUrl = (id: string, grantId: string) => `${grantsUrl(id)}/${grantId}`;

    it("changes a grant's role (200)", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();
      const created = await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.CREATED);
      const grantId = (created.body as { id: string }).id;

      const updated = await testApp
        .patch(updateUrl(experiment.id, grantId))
        .withAuth(owner)
        .send({ role: "admin" })
        .expect(StatusCodes.OK);
      expect((updated.body as { role: string }).role).toBe("admin");
    });

    it("404 when updating a non-existent grant", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp
        .patch(updateUrl(experiment.id, crypto.randomUUID()))
        .withAuth(owner)
        .send({ role: "admin" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("403 when the actor cannot share the resource", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();
      const created = await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.CREATED);
      const grantId = (created.body as { id: string }).id;

      const stranger = await testApp.createTestUser();
      await testApp
        .patch(updateUrl(experiment.id, grantId))
        .withAuth(stranger)
        .send({ role: "admin" })
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("revokeResourceGrant", () => {
    it("revokes an existing grant (200)", async () => {
      const { owner, experiment } = await ownedExperiment();
      const grantee = await testApp.createTestUser();
      const created = await testApp
        .post(grantsUrl(experiment.id))
        .withAuth(owner)
        .send({ granteeType: "user", granteeId: grantee, role: "member" })
        .expect(StatusCodes.CREATED);

      const grantId = (created.body as { id: string }).id;
      await testApp
        .delete(`${grantsUrl(experiment.id)}/${grantId}`)
        .withAuth(owner)
        .expect(StatusCodes.OK);

      const list = await testApp
        .get(grantsUrl(experiment.id))
        .withAuth(owner)
        .expect(StatusCodes.OK);
      expect(list.body).toHaveLength(0);
    });

    it("404 when revoking a non-existent grant", async () => {
      const { owner, experiment } = await ownedExperiment();
      await testApp
        .delete(`${grantsUrl(experiment.id)}/${crypto.randomUUID()}`)
        .withAuth(owner)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("404 when revoking on a non-existent resource", async () => {
      const user = await testApp.createTestUser();
      await testApp
        .delete(`${grantsUrl(crypto.randomUUID())}/${crypto.randomUUID()}`)
        .withAuth(user)
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
