import { StatusCodes } from "http-status-codes";

import { TestHarness } from "../test/test-harness";

describe("OrganizationsController", () => {
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

  /** A public org owned by `owner` (owner role), plus the owner id. */
  async function publicOrg(name = "Community Lab") {
    const owner = await testApp.createTestUser();
    const org = await testApp.createOrganization({ name, visibility: "public" });
    await testApp.addOrgMember(org.id, owner, "owner");
    return { owner, org };
  }

  describe("listPublicOrganizations", () => {
    it("lists public orgs with member count and the caller's membership status", async () => {
      const { org } = await publicOrg("Photosynthesis Public");
      const viewer = await testApp.createTestUser();

      const res = await testApp
        .get("/api/v1/organizations/public")
        .withAuth(viewer)
        .expect(StatusCodes.OK);
      const orgs = res.body as {
        id: string;
        memberCount: number;
        membershipStatus: string;
      }[];
      const found = orgs.find((o) => o.id === org.id);
      expect(found).toBeTruthy();
      expect(found?.memberCount).toBe(1);
      expect(found?.membershipStatus).toBe("none");
    });

    it("does not list private orgs and filters by search", async () => {
      const priv = await testApp.createOrganization({ name: "Secret Lab", visibility: "private" });
      const { org } = await publicOrg("Findable Org");
      const viewer = await testApp.createTestUser();

      const res = await testApp
        .get("/api/v1/organizations/public?search=Findable")
        .withAuth(viewer)
        .expect(StatusCodes.OK);
      const ids = (res.body as { id: string }[]).map((o) => o.id);
      expect(ids).toContain(org.id);
      expect(ids).not.toContain(priv.id);
    });
  });

  describe("getOrganization", () => {
    it("returns a public org to anyone", async () => {
      const { org } = await publicOrg();
      const viewer = await testApp.createTestUser();
      const res = await testApp
        .get(`/api/v1/organizations/${org.id}`)
        .withAuth(viewer)
        .expect(StatusCodes.OK);
      expect((res.body as { id: string }).id).toBe(org.id);
    });

    it("403s a non-member on a private org, 200s a member", async () => {
      const org = await testApp.createOrganization({ visibility: "private" });
      const member = await testApp.createTestUser();
      await testApp.addOrgMember(org.id, member, "member");
      const stranger = await testApp.createTestUser();

      await testApp
        .get(`/api/v1/organizations/${org.id}`)
        .withAuth(stranger)
        .expect(StatusCodes.FORBIDDEN);
      await testApp.get(`/api/v1/organizations/${org.id}`).withAuth(member).expect(StatusCodes.OK);
    });

    it("404s a missing org", async () => {
      const user = await testApp.createTestUser();
      await testApp
        .get(`/api/v1/organizations/${crypto.randomUUID()}`)
        .withAuth(user)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("getOrganizationResources", () => {
    it("returns only the org's public entities", async () => {
      const { owner, org } = await publicOrg();
      await testApp.createMacro({
        name: `Public Macro ${crypto.randomUUID().slice(0, 8)}`,
        createdBy: owner,
        organizationId: org.id,
        visibility: "public",
      });
      await testApp.createMacro({
        name: `Private Macro ${crypto.randomUUID().slice(0, 8)}`,
        createdBy: owner,
        organizationId: org.id,
        visibility: "private",
      });
      const viewer = await testApp.createTestUser();

      const res = await testApp
        .get(`/api/v1/organizations/${org.id}/resources`)
        .withAuth(viewer)
        .expect(StatusCodes.OK);
      const body = res.body as { macros: { name: string }[] };
      expect(body.macros).toHaveLength(1);
      expect(body.macros[0].name).toContain("Public Macro");
    });

    it("includes private entities for a member of the org", async () => {
      const { owner, org } = await publicOrg();
      await testApp.createMacro({
        name: `Member Private ${crypto.randomUUID().slice(0, 8)}`,
        createdBy: owner,
        organizationId: org.id,
        visibility: "private",
      });

      const res = await testApp
        .get(`/api/v1/organizations/${org.id}/resources`)
        .withAuth(owner)
        .expect(StatusCodes.OK);
      const body = res.body as { macros: { name: string }[] };
      expect(body.macros.some((m) => m.name.includes("Member Private"))).toBe(true);
    });
  });

  describe("getOrganizationAccess", () => {
    const accessUrl = (id: string) => `/api/v1/organizations/${id}/access`;

    it("returns members + teams for a member", async () => {
      const { owner, org } = await publicOrg();
      const team = await testApp.createTeam(org.id, "Imaging");
      await testApp.addTeamMember(team.id, owner);

      const res = await testApp.get(accessUrl(org.id)).withAuth(owner).expect(StatusCodes.OK);
      const body = res.body as {
        organization: { id: string };
        members: { id: string; role: string }[];
        teams: { name: string; memberCount: number }[];
      };
      expect(body.organization.id).toBe(org.id);
      expect(body.members.some((m) => m.id === owner && m.role === "owner")).toBe(true);
      expect(body.teams).toHaveLength(1);
      expect(body.teams[0]).toMatchObject({ name: "Imaging", memberCount: 1 });
    });

    it("403s a non-member", async () => {
      const { org } = await publicOrg();
      const stranger = await testApp.createTestUser();
      await testApp.get(accessUrl(org.id)).withAuth(stranger).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("requestToJoin", () => {
    const url = (id: string) => `/api/v1/organizations/${id}/join-requests`;

    it("creates a pending request (201) and is idempotent (200)", async () => {
      const { org } = await publicOrg();
      const user = await testApp.createTestUser();

      await testApp.post(url(org.id)).withAuth(user).send({}).expect(StatusCodes.CREATED);
      await testApp.post(url(org.id)).withAuth(user).send({}).expect(StatusCodes.OK);
    });

    it("409s when already a member", async () => {
      const { owner, org } = await publicOrg();
      await testApp.post(url(org.id)).withAuth(owner).send({}).expect(StatusCodes.CONFLICT);
    });

    it("403s on a private org", async () => {
      const org = await testApp.createOrganization({ visibility: "private" });
      const user = await testApp.createTestUser();
      await testApp.post(url(org.id)).withAuth(user).send({}).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("join-request decisions", () => {
    const url = (id: string) => `/api/v1/organizations/${id}/join-requests`;

    async function pendingRequest() {
      const { owner, org } = await publicOrg();
      const applicant = await testApp.createTestUser();
      const created = await testApp
        .post(url(org.id))
        .withAuth(applicant)
        .send({ message: "let me in" })
        .expect(StatusCodes.CREATED);
      const requestId = (created.body as { id: string }).id;
      return { owner, org, applicant, requestId };
    }

    it("403s a non-manager listing requests; lists for an owner", async () => {
      const { owner, org, applicant } = await pendingRequest();
      await testApp.get(url(org.id)).withAuth(applicant).expect(StatusCodes.FORBIDDEN);
      const list = await testApp.get(url(org.id)).withAuth(owner).expect(StatusCodes.OK);
      expect((list.body as unknown[]).length).toBe(1);
    });

    it("approves a request, adding the user as a member", async () => {
      const { owner, org, applicant, requestId } = await pendingRequest();
      await testApp
        .post(`${url(org.id)}/${requestId}/approve`)
        .withAuth(owner)
        .send({})
        .expect(StatusCodes.OK);
      // Approved applicant is now a member → can view the (public) org and is "member".
      const res = await testApp
        .get(`/api/v1/organizations/${org.id}`)
        .withAuth(applicant)
        .expect(StatusCodes.OK);
      expect((res.body as { membershipStatus: string }).membershipStatus).toBe("member");
    });

    it("rejects a request without adding the user", async () => {
      const { owner, org, applicant, requestId } = await pendingRequest();
      await testApp
        .post(`${url(org.id)}/${requestId}/reject`)
        .withAuth(owner)
        .send({})
        .expect(StatusCodes.OK);
      const res = await testApp
        .get(`/api/v1/organizations/${org.id}`)
        .withAuth(applicant)
        .expect(StatusCodes.OK);
      expect((res.body as { membershipStatus: string }).membershipStatus).toBe("none");
    });

    it("lets the applicant cancel their own request but not others'", async () => {
      const { org, applicant, requestId } = await pendingRequest();
      const other = await testApp.createTestUser();
      await testApp
        .delete(`${url(org.id)}/${requestId}`)
        .withAuth(other)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .delete(`${url(org.id)}/${requestId}`)
        .withAuth(applicant)
        .expect(StatusCodes.OK);
    });
  });
});
