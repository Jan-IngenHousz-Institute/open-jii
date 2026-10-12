import { experimentJoinRequests, organizationMembers, resourceGrants } from "@repo/database";

import { AppError, failure } from "../common/utils/fp-utils";
import { TestHarness } from "../test/test-harness";
import {
  EmailVisibilityService,
  collaboratorEmail,
  flatEmail,
  nestedUserEmail,
} from "./email-visibility.service";

describe("EmailVisibilityService", () => {
  const testApp = TestHarness.App;
  let service: EmailVisibilityService;
  let callerId: string;
  let targetId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(EmailVisibilityService);
    callerId = await testApp.createTestUser({});
    targetId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const sees = async (scope?: { experimentId: string }) =>
    (await service.visibleUserEmails(callerId, [targetId], scope)).has(targetId);

  async function sharedOrganization(callerRole: string, targetRole: "owner" | "admin" | "member") {
    const orgId = await testApp.createOrganization();
    // Inserted directly: Better Auth may store a comma-joined role the helper won't take.
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: callerId, role: callerRole });
    await testApp.addOrganizationMember(orgId, targetId, targetRole);
    return orgId;
  }

  async function experimentWithJoinRequest(status: "pending" | "rejected" = "pending") {
    const ownerId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
    await testApp.database
      .insert(experimentJoinRequests)
      .values({ experimentId: experiment.id, userId: targetId, status });
    return { experiment, ownerId };
  }

  describe("R1: the user themself", () => {
    it("sees their own address", async () => {
      expect((await service.visibleUserEmails(callerId, [callerId])).has(callerId)).toBe(true);
    });

    it("sees nobody else's by default", async () => {
      expect(await sees()).toBe(false);
    });
  });

  describe("R2: organization owners and admins over their members", () => {
    it.each(["owner", "admin", "member,admin"])("a %s sees a member's address", async (role) => {
      await sharedOrganization(role, "member");
      expect(await sees()).toBe(true);
    });

    it("a plain member does not see an owner's address", async () => {
      await sharedOrganization("member", "owner");
      expect(await sees()).toBe(false);
    });

    it("an admin of one organization does not see a member of another", async () => {
      const mine = await testApp.createOrganization();
      await testApp.addOrganizationMember(mine, callerId, "admin");
      const theirs = await testApp.createOrganization();
      await testApp.addOrganizationMember(theirs, targetId, "member");

      expect(await sees()).toBe(false);
    });
  });

  describe("R3: organization owners and admins over people asking to join", () => {
    it("an admin sees a pending requester's address", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, callerId, "admin");
      await testApp.addOrganizationJoinRequest(orgId, targetId);

      expect(await sees()).toBe(true);
    });

    it("an admin does not see a rejected requester's address", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, callerId, "admin");
      await testApp.addOrganizationJoinRequest(orgId, targetId, { status: "rejected" });

      expect(await sees()).toBe(false);
    });

    it("a plain member does not see a pending requester's address", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, callerId, "member");
      await testApp.addOrganizationJoinRequest(orgId, targetId);

      expect(await sees()).toBe(false);
    });
  });

  describe("R4: experiment managers over people asking to join, within that experiment", () => {
    it("the experiment's owner sees a pending requester in its scope", async () => {
      const { experiment, ownerId } = await experimentWithJoinRequest();
      callerId = ownerId;

      expect(await sees({ experimentId: experiment.id })).toBe(true);
    });

    it("the same owner does not see the requester outside that scope", async () => {
      const { ownerId } = await experimentWithJoinRequest();
      callerId = ownerId;

      expect(await sees()).toBe(false);
    });

    it("a direct admin grant sees a pending requester", async () => {
      const { experiment } = await experimentWithJoinRequest();
      await testApp.addExperimentAdmin(experiment.id, callerId);

      expect(await sees({ experimentId: experiment.id })).toBe(true);
    });

    it("a team admin grant sees a pending requester", async () => {
      const { experiment } = await experimentWithJoinRequest();
      const orgId = await testApp.createOrganization();
      const teamId = await testApp.createTeam(orgId);
      await testApp.addTeamMember(teamId, callerId);
      await testApp.database.insert(resourceGrants).values({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "team",
        granteeId: teamId,
        role: "admin",
      });

      expect(await sees({ experimentId: experiment.id })).toBe(true);
    });

    it("an organization admin grant sees a pending requester", async () => {
      const { experiment } = await experimentWithJoinRequest();
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, callerId, "member");
      await testApp.database.insert(resourceGrants).values({
        resourceType: "experiment",
        resourceId: experiment.id,
        granteeType: "organization",
        granteeId: orgId,
        role: "admin",
      });

      expect(await sees({ experimentId: experiment.id })).toBe(true);
    });

    it("a viewer of the experiment does not see the requester", async () => {
      const { experiment } = await experimentWithJoinRequest();
      await testApp.addExperimentCollaborator(experiment.id, callerId);

      expect(await sees({ experimentId: experiment.id })).toBe(false);
    });

    it("a manager does not see a requester who was already rejected", async () => {
      const { experiment, ownerId } = await experimentWithJoinRequest("rejected");
      callerId = ownerId;

      expect(await sees({ experimentId: experiment.id })).toBe(false);
    });
  });

  describe("one SQL round trip", () => {
    it("looks up organization evidence in one statement", async () => {
      await sharedOrganization("owner", "member");
      const execute = vi.spyOn(testApp.database, "execute");

      try {
        expect(await sees()).toBe(true);
        expect(execute).toHaveBeenCalledTimes(1);
      } finally {
        execute.mockRestore();
      }
    });

    it("looks up experiment management and requests in the same statement", async () => {
      const { experiment, ownerId } = await experimentWithJoinRequest();
      callerId = ownerId;
      const execute = vi.spyOn(testApp.database, "execute");

      try {
        expect(await sees({ experimentId: experiment.id })).toBe(true);
        expect(execute).toHaveBeenCalledTimes(1);
      } finally {
        execute.mockRestore();
      }
    });
  });

  describe("no resource-admin rule", () => {
    it("an admin grant on an experiment confers nothing over its grantees", async () => {
      const ownerId = await testApp.createTestUser({});
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: ownerId });
      await testApp.addExperimentAdmin(experiment.id, callerId);
      await testApp.addExperimentCollaborator(experiment.id, targetId);

      expect(await sees({ experimentId: experiment.id })).toBe(false);
    });

    it("owning the experiment confers nothing over a grantee from outside the organization", async () => {
      const { experiment } = await testApp.createExperiment({ name: "Exp", userId: callerId });
      await testApp.addExperimentCollaborator(experiment.id, targetId);

      expect(await sees({ experimentId: experiment.id })).toBe(false);
    });
  });

  describe("redaction", () => {
    it("preserves a failed write without querying email visibility", async () => {
      const writeFailure = failure(AppError.internal("Decision not committed"));
      const visibility = vi.spyOn(service, "visibleUserEmails");

      const result = await service.redactAfterWrite(callerId, writeFailure, nestedUserEmail());

      expect(result).toBe(writeFailure);
      expect(visibility).not.toHaveBeenCalled();
    });

    it("nulls a flat row's address and leaves a visible one", async () => {
      const rows = [
        { userId: callerId, email: "me@example.com" },
        { userId: targetId, email: "them@example.com" },
      ];

      const redacted = await service.redact(callerId, rows, flatEmail());

      expect(redacted.map((row) => row.email)).toEqual(["me@example.com", null]);
    });

    it("nulls a nested user's address", async () => {
      const [row] = await service.redact(
        callerId,
        [{ id: "request", user: { id: targetId, email: "them@example.com" } }],
        nestedUserEmail(),
      );

      expect(row.user.email).toBeNull();
    });

    it("nulls a collaborator row's address and leaves summary rows alone", async () => {
      const grantee = {
        type: "user" as const,
        displayName: "Them",
        email: "them@example.com",
        avatarUrl: null,
        memberCount: null,
      };
      const rows = [
        {
          kind: "owner" as const,
          granteeType: "user" as const,
          granteeId: targetId,
          organizationName: "Org",
          grantee,
          inertGrant: null,
        },
        {
          kind: "orgMembers" as const,
          organizationId: callerId,
          organizationName: "Org",
          memberCount: 3,
        },
      ];

      const redacted = await service.redact(callerId, rows, collaboratorEmail());

      expect(redacted[0]).toMatchObject({ grantee: { email: null, displayName: "Them" } });
      expect(redacted[1]).toEqual(rows[1]);
    });

    it("shows an invitation's address only to whoever created it", () => {
      const invitations = [
        { invitedBy: callerId, email: "mine@example.com" },
        { invitedBy: targetId, email: "theirs@example.com" },
      ];

      expect(service.redactInvitations(callerId, invitations).map((row) => row.email)).toEqual([
        "mine@example.com",
        null,
      ]);
    });
  });
});
