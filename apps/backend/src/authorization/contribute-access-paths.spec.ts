import { experiments, teamMembers, teams } from "@repo/database";

import { TestHarness } from "../test/test-harness";
import { AuthorizationService } from "./authorization.service";

/**
 * Where the right to contribute lands, per access path, resolved by `can()`
 * against a real database.
 *
 * Contributing (adding measurements and annotations) used to be roster
 * membership; it is now an action in its own right, and this pins which paths
 * carry it. The two that must NOT carry it are the ones that hand out access
 * without anyone deciding to collaborate with you: a plain role in the owning
 * organization, and the public visibility tier. Everything else — an explicit
 * grant at any tier, to you, your team or your org — does.
 *
 * The table below is the whole point of the spec: every access path × every
 * action group, one assertion each, so a reclassification cannot pass silently.
 */
describe("can() — the right to contribute, by access path", () => {
  const testApp = TestHarness.App;
  let authz: AuthorizationService;
  let orgOwnerId: string;
  let orgId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    authz = testApp.module.get(AuthorizationService);
    orgOwnerId = await testApp.createTestUser({});
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, orgOwnerId, "owner");
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** An experiment owned by the shared org, so org-role paths are exercisable. */
  async function makeExperiment(visibility: "private" | "public") {
    const [experiment] = await testApp.database
      .insert(experiments)
      .values({
        name: `Experiment ${crypto.randomUUID()}`,
        description: "Access path fixture",
        status: "active",
        visibility,
        createdBy: orgOwnerId,
        organizationId: orgId,
      })
      .returning();
    return experiment;
  }

  async function allows(userId: string, resourceId: string) {
    const answers = await Promise.all(
      (["read", "contribute", "update", "share", "manage"] as const).map(async (action) => {
        const decision = await authz.can(userId, {
          resourceType: "experiment",
          resourceId,
          action,
        });
        return [action, decision.allow] as const;
      }),
    );
    return Object.fromEntries(answers) as Record<
      "read" | "contribute" | "update" | "share" | "manage",
      boolean
    >;
  }

  const READ_ONLY = {
    read: true,
    contribute: false,
    update: false,
    share: false,
    manage: false,
  };
  const CONTRIBUTOR = {
    read: true,
    contribute: true,
    update: false,
    share: false,
    manage: false,
  };
  const FULL = { read: true, contribute: true, update: true, share: true, manage: true };
  const NOTHING = {
    read: false,
    contribute: false,
    update: false,
    share: false,
    manage: false,
  };

  describe("paths that do NOT carry contribute", () => {
    it("a plain member of the owning organization reads, and only reads", async () => {
      const experiment = await makeExperiment("private");
      const orgMember = await testApp.createTestUser({ email: "org-member@example.com" });
      await testApp.addOrganizationMember(orgId, orgMember, "member");

      expect(await allows(orgMember, experiment.id)).toEqual(READ_ONLY);
    });

    it("a stranger on a public experiment reads, and only reads", async () => {
      const experiment = await makeExperiment("public");
      const stranger = await testApp.createTestUser({ email: "stranger@example.com" });

      expect(await allows(stranger, experiment.id)).toEqual(READ_ONLY);
    });

    it("a stranger on a private experiment gets nothing", async () => {
      const experiment = await makeExperiment("private");
      const stranger = await testApp.createTestUser({ email: "outsider@example.com" });

      expect(await allows(stranger, experiment.id)).toEqual(NOTHING);
    });
  });

  describe("paths that carry contribute", () => {
    it("an owner of the owning organization can do everything", async () => {
      const experiment = await makeExperiment("private");

      expect(await allows(orgOwnerId, experiment.id)).toEqual(FULL);
    });

    it("an admin of the owning organization can do everything", async () => {
      const experiment = await makeExperiment("private");
      const orgAdmin = await testApp.createTestUser({ email: "org-admin@example.com" });
      await testApp.addOrganizationMember(orgId, orgAdmin, "admin");

      expect(await allows(orgAdmin, experiment.id)).toEqual(FULL);
    });

    it.each(["member", "viewer"] as const)(
      "a direct %s grant contributes but cannot administer",
      async (role) => {
        const experiment = await makeExperiment("private");
        const grantee = await testApp.createTestUser({ email: `${role}-grantee@example.com` });
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experiment.id,
          granteeType: "user",
          granteeId: grantee,
          role,
        });

        expect(await allows(grantee, experiment.id)).toEqual(CONTRIBUTOR);
      },
    );

    it.each(["admin", "owner"] as const)("a direct %s grant can do everything", async (role) => {
      const experiment = await makeExperiment("private");
      const grantee = await testApp.createTestUser({ email: `${role}-grantee@example.com` });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: grantee,
        role,
      });

      expect(await allows(grantee, experiment.id)).toEqual(FULL);
    });

    it("a team grant carries contribute to every member of that team", async () => {
      const experiment = await makeExperiment("private");
      const teamMember = await testApp.createTestUser({ email: "team-member@example.com" });
      const [team] = await testApp.database
        .insert(teams)
        .values({ organizationId: orgId, name: `Team ${crypto.randomUUID()}` })
        .returning();
      await testApp.database.insert(teamMembers).values({ teamId: team.id, userId: teamMember });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: team.id,
        role: "member",
      });

      expect(await allows(teamMember, experiment.id)).toEqual(CONTRIBUTOR);
    });

    it("an organization grant carries contribute to that org's members", async () => {
      const experiment = await makeExperiment("private");
      const otherOrgId = await testApp.createOrganization();
      const otherOrgMember = await testApp.createTestUser({ email: "other-org@example.com" });
      await testApp.addOrganizationMember(otherOrgId, otherOrgMember, "member");
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: otherOrgId,
        role: "member",
      });

      expect(await allows(otherOrgMember, experiment.id)).toEqual(CONTRIBUTOR);
    });
  });

  describe("precedence between the paths", () => {
    it("a grant raises a plain org member from read-only to contributing", async () => {
      const experiment = await makeExperiment("private");
      const orgMember = await testApp.createTestUser({ email: "raised@example.com" });
      await testApp.addOrganizationMember(orgId, orgMember, "member");

      expect(await allows(orgMember, experiment.id)).toEqual(READ_ONLY);

      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "user",
        granteeId: orgMember,
        role: "member",
      });

      expect(await allows(orgMember, experiment.id)).toEqual(CONTRIBUTOR);
    });

    it("the public tier is a read tier: contribute comes back forbidden, not allowed", async () => {
      const experiment = await makeExperiment("public");
      const stranger = await testApp.createTestUser({ email: "public-stranger@example.com" });

      const decision = await authz.can(stranger, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action: "contribute",
      });
      expect(decision).toEqual({ allow: false, reason: "forbidden" });
    });
  });
});
