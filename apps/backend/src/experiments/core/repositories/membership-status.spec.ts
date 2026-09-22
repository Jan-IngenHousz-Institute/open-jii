import { faker } from "@faker-js/faker";

import type { ExperimentMembershipStatus } from "@repo/api/domains/experiment/experiment.schema";
import { eq, experiments, organizationMembers, resourceGrants } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "./experiment-join-request.repository";
import { ExperimentRepository } from "./experiment.repository";

/**
 * `membershipStatus` is computed twice — in SQL for a whole listing, and from
 * `can(contribute)` for one experiment — and the two must never disagree. A list row
 * that claims membership the detail screen denies is a participant told they may
 * measure into something that will refuse their data.
 *
 * Every case here asserts both computations at once, so a divergence fails rather
 * than hiding in whichever surface the test happened to read.
 */
describe("experiment membershipStatus", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let joinRequestRepository: ExperimentJoinRequestRepository;
  let ownerId: string;
  let callerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({ email: "owner@example.com" });
    callerId = await testApp.createTestUser({ email: "caller@example.com" });
    repository = testApp.module.get(ExperimentRepository);
    joinRequestRepository = testApp.module.get(ExperimentJoinRequestRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedExperiment(options: { createdBy?: string; organizationId?: string } = {}) {
    const { experiment } = await testApp.createExperiment({
      name: `Membership ${faker.string.uuid()}`,
      userId: options.createdBy ?? ownerId,
      visibility: "public",
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    });
    return experiment;
  }

  /** What the list row says and what the access read says, for the same caller. */
  async function bothViews(experimentId: string, userId: string) {
    const listed = await repository.findAll(userId, "all");
    assertSuccess(listed);
    const row = listed.value.find((entry) => entry.id === experimentId);

    const access = await repository.checkAccess(experimentId, userId);
    assertSuccess(access);

    return {
      list: row?.membershipStatus,
      access: access.value.membershipStatus,
      canContribute: access.value.canContribute,
    };
  }

  /**
   * Both computations agree, and they agree with `can(contribute)` — which is what
   * `member` is defined to mean.
   */
  async function expectAgreement(
    experimentId: string,
    userId: string,
    expected: ExperimentMembershipStatus,
  ) {
    const views = await bothViews(experimentId, userId);

    expect(views).toEqual({
      list: expected,
      access: expected,
      canContribute: expected === "member",
    });
  }

  describe("every relationship path that carries contribute reads as member", () => {
    it("direct viewer grant", async () => {
      const experiment = await seedExperiment();
      await testApp.addExperimentCollaborator(experiment.id, callerId);

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("direct admin grant", async () => {
      const experiment = await seedExperiment();
      await testApp.addExperimentAdmin(experiment.id, callerId);

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("team grant", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, ownerId, "owner");
      const teamId = await testApp.createTeam(organizationId);
      await testApp.addTeamMember(teamId, callerId);
      const experiment = await seedExperiment({ organizationId });
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: teamId,
        role: "viewer",
      });

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("organization grant", async () => {
      const granteeOrgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(granteeOrgId, callerId, "member");
      const experiment = await seedExperiment();
      await testApp.addResourceGrant({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: granteeOrgId,
        role: "viewer",
      });

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("owning-org member", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, ownerId, "owner");
      await testApp.addOrganizationMember(organizationId, callerId, "member");
      const experiment = await seedExperiment({ organizationId });

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("owning-org admin", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, ownerId, "owner");
      await testApp.addOrganizationMember(organizationId, callerId, "admin");
      const experiment = await seedExperiment({ organizationId });

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("creator in their own personal workspace", async () => {
      const experiment = await seedExperiment({ createdBy: callerId });

      await expectAgreement(experiment.id, callerId, "member");
    });
  });

  describe("no contributing path", () => {
    it("a public reader is none on both", async () => {
      const experiment = await seedExperiment();

      await expectAgreement(experiment.id, callerId, "none");
    });

    it("a public reader with a pending request is pending_request on both", async () => {
      const experiment = await seedExperiment();
      assertSuccess(await joinRequestRepository.create(experiment.id, callerId, "let me in"));

      await expectAgreement(experiment.id, callerId, "pending_request");
    });

    it("falls back to none once that request is decided", async () => {
      const experiment = await seedExperiment();
      const request = await joinRequestRepository.create(experiment.id, callerId, undefined);
      assertSuccess(request);
      assertSuccess(
        await joinRequestRepository.markDecided(request.value.id, "cancelled", callerId),
      );

      await expectAgreement(experiment.id, callerId, "none");
    });

    it("a member with a stale pending request still reads as member", async () => {
      // Membership wins: the request is moot, and `pending_request` would offer a
      // CTA to ask for access they already hold.
      const experiment = await seedExperiment();
      assertSuccess(await joinRequestRepository.create(experiment.id, callerId, undefined));
      await testApp.addExperimentCollaborator(experiment.id, callerId);

      await expectAgreement(experiment.id, callerId, "member");
    });

    it("a creator removed from the owning organization is none, though they still see the row", async () => {
      // Authorship is not an access path. The row stays reachable under `related`,
      // and the truth about it is that they can look but not measure.
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, callerId, "member");
      const experiment = await seedExperiment({ createdBy: callerId, organizationId });
      await testApp.database
        .delete(organizationMembers)
        .where(eq(organizationMembers.userId, callerId));

      await expectAgreement(experiment.id, callerId, "none");

      const related = await repository.findAll(callerId, "related");
      assertSuccess(related);
      const row = related.value.find((entry) => entry.id === experiment.id);
      expect(row?.membershipStatus).toBe("none");
    });

    it("a grant on another experiment does not leak across rows", async () => {
      const granted = await seedExperiment();
      const other = await seedExperiment();
      await testApp.addExperimentCollaborator(granted.id, callerId);

      await expectAgreement(granted.id, callerId, "member");
      await expectAgreement(other.id, callerId, "none");
    });
  });

  /**
   * Both role columns are unrestricted text, and `can()` tokenizes them and refuses
   * anything it does not recognize. These rows are written raw because the write
   * helpers refuse them — which is exactly why the SQL cannot assume they are absent.
   */
  describe("stored role tokens the write helpers would refuse", () => {
    async function rawGrant(experimentId: string, role: string) {
      await testApp.database.insert(resourceGrants).values({
        resourceType: "experiment",
        resourceId: experimentId,
        granteeType: "user",
        granteeId: callerId,
        role,
      });
    }

    async function rawOwningOrgMembership(role: string) {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, ownerId, "owner");
      const experiment = await seedExperiment({ organizationId });
      await testApp.database
        .insert(organizationMembers)
        .values({ organizationId, userId: callerId, role });
      return experiment;
    }

    it.each([
      ["member", "none"],
      ["bogus", "none"],
      ["", "none"],
      ["viewer", "member"],
      ["viewer,bogus", "member"],
      ["bogus,admin", "member"],
    ] as const)("a grant role of %j reads as %s on both", async (role, expected) => {
      const experiment = await seedExperiment();
      await rawGrant(experiment.id, role);

      await expectAgreement(experiment.id, callerId, expected);
    });

    it.each([
      ["viewer", "none"],
      ["bogus", "none"],
      ["", "none"],
      ["member", "member"],
      ["member,bogus", "member"],
      ["bogus,admin", "member"],
    ] as const)("an owning-org role of %j reads as %s on both", async (role, expected) => {
      const experiment = await rawOwningOrgMembership(role);

      await expectAgreement(experiment.id, callerId, expected);
    });

    /**
     * A multi-role string written with a space after the comma. The evaluator trims
     * each token, so it must; splitting on the comma alone leaves ` admin` padded and
     * matching nothing, which is a list row and a detail read disagreeing — the one
     * thing this predicate exists to prevent.
     */
    it.each([
      ["viewer, admin", "member"],
      ["bogus, viewer", "member"],
      ["bogus, nonsense", "none"],
    ] as const)("a spaced grant role of %j reads as %s on both", async (role, expected) => {
      const experiment = await seedExperiment();
      await rawGrant(experiment.id, role);

      await expectAgreement(experiment.id, callerId, expected);
    });

    it.each([
      ["member, bogus", "member"],
      ["bogus, admin", "member"],
      ["bogus, viewer", "none"],
    ] as const)("a spaced owning-org role of %j reads as %s on both", async (role, expected) => {
      const experiment = await rawOwningOrgMembership(role);

      await expectAgreement(experiment.id, callerId, expected);
    });

    it("does not read a token with a space inside it as that role", async () => {
      // Trimmed at the boundaries only. Stripping every space would turn "ad min"
      // into `admin` and hand out access the evaluator refuses outright.
      const experiment = await seedExperiment();
      await rawGrant(experiment.id, "vie wer");

      await expectAgreement(experiment.id, callerId, "none");
    });
  });

  describe("the slices stay honest against each other", () => {
    it("member rows in `all` equal the `related` rows minus the authorship-only ones", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, ownerId, "owner");

      // One of each: a grant, an owning-org membership, authorship with no access
      // path, and a public row the caller has no relationship with at all.
      const granted = await seedExperiment();
      await testApp.addExperimentCollaborator(granted.id, callerId);

      await testApp.addOrganizationMember(organizationId, callerId, "member");
      const throughOrg = await seedExperiment({ organizationId });

      const strandedOrgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(strandedOrgId, ownerId, "owner");
      const authoredOnly = await seedExperiment({
        createdBy: callerId,
        organizationId: strandedOrgId,
      });

      await seedExperiment();

      const all = await repository.findAll(callerId, "all");
      const related = await repository.findAll(callerId, "related");
      assertSuccess(all);
      assertSuccess(related);

      const members = all.value.filter((row) => row.membershipStatus === "member");
      const authorshipOnly = related.value.filter((row) => row.membershipStatus !== "member");

      expect(members.map((row) => row.id).sort()).toEqual([granted.id, throughOrg.id].sort());
      expect(authorshipOnly.map((row) => row.id)).toEqual([authoredOnly.id]);
      expect(members).toHaveLength(related.value.length - authorshipOnly.length);
    });

    it("carries the field on the paginated listing too", async () => {
      const experiment = await seedExperiment();
      await testApp.addExperimentCollaborator(experiment.id, callerId);

      const page = await repository.findPage(callerId, 1, 20, "all");

      assertSuccess(page);
      const row = page.value.items.find((entry) => entry.id === experiment.id);
      expect(row?.membershipStatus).toBe("member");
    });

    it("keeps list and access agreeing on an archived experiment", async () => {
      // Archived rows drop out of a default listing but stay readable by id, so the
      // two views have to agree for the caller who asks for them explicitly.
      const experiment = await seedExperiment();
      await testApp.addExperimentCollaborator(experiment.id, callerId);
      await testApp.database
        .update(experiments)
        .set({ status: "archived" })
        .where(eq(experiments.id, experiment.id));

      const listed = await repository.findAll(callerId, "all", "archived");
      const access = await repository.checkAccess(experiment.id, callerId);
      assertSuccess(listed);
      assertSuccess(access);

      const row = listed.value.find((entry) => entry.id === experiment.id);
      expect(row?.membershipStatus).toBe("member");
      expect(access.value.membershipStatus).toBe("member");
    });

    it("says none on an archived experiment the caller merely reads", async () => {
      const experiment = await seedExperiment();
      await testApp.database
        .update(experiments)
        .set({ status: "archived" })
        .where(eq(experiments.id, experiment.id));

      const listed = await repository.findAll(callerId, "all", "archived");
      const access = await repository.checkAccess(experiment.id, callerId);
      assertSuccess(listed);
      assertSuccess(access);

      const row = listed.value.find((entry) => entry.id === experiment.id);
      expect(row?.membershipStatus).toBe("none");
      expect(access.value.membershipStatus).toBe("none");
    });
  });
});
