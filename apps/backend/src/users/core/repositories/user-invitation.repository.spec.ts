import { faker } from "@faker-js/faker";

import { and, eq, invitations, resourceGrants } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { InvitationRepository } from "./user-invitation.repository";

describe("InvitationRepository", () => {
  const testApp = TestHarness.App;
  let repository: InvitationRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(InvitationRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new invitation", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Create Invitation Test",
        userId: testUserId,
      });

      const result = await repository.create(
        "experiment",
        experiment.id,
        "invite@example.com",
        { tier: "viewer" },
        testUserId,
      );

      assertSuccess(result);
      expect(result.value).toMatchObject({
        resourceType: "experiment",
        resourceId: experiment.id,
        email: "invite@example.com",
        // Least privilege by default: the contributing "can view" tier.
        tier: "viewer",
        status: "pending",
        invitedBy: testUserId,
      });
      expect(result.value.id).toBeDefined();
      expect(result.value.createdAt).toBeDefined();

      const [stored] = await testApp.database
        .select({ role: invitations.role })
        .from(invitations)
        .where(eq(invitations.id, result.value.id));
      expect(stored.role).toBe("viewer");
    });

    it("should lowercase the email", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Lowercase Email Test",
        userId: testUserId,
      });

      const result = await repository.create(
        "experiment",
        experiment.id,
        "UPPER@EXAMPLE.COM",
        { tier: "viewer" },
        testUserId,
      );

      assertSuccess(result);
      expect(result.value.email).toBe("upper@example.com");
    });
  });

  describe("findPendingByResourceAndEmail", () => {
    it("should find existing pending invitation", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Find Pending Test",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        experiment.id,
        "pending@example.com",
        { tier: "viewer" },
        testUserId,
      );

      const result = await repository.findPendingByResourceAndEmail(
        "experiment",
        experiment.id,
        "pending@example.com",
      );

      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value?.email).toBe("pending@example.com");
      expect(result.value?.status).toBe("pending");
    });

    it("should return null when no pending invitation exists", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "No Pending Test",
        userId: testUserId,
      });

      const result = await repository.findPendingByResourceAndEmail(
        "experiment",
        experiment.id,
        "nonexistent@example.com",
      );

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should not find revoked invitations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Revoked Not Found Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "revoked@example.com",
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);

      await repository.revoke(createResult.value.id);

      const result = await repository.findPendingByResourceAndEmail(
        "experiment",
        experiment.id,
        "revoked@example.com",
      );

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should match email case-insensitively", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Case Insensitive Test",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        experiment.id,
        "case@example.com",
        { tier: "viewer" },
        testUserId,
      );

      const result = await repository.findPendingByResourceAndEmail(
        "experiment",
        experiment.id,
        "CASE@EXAMPLE.COM",
      );

      assertSuccess(result);
      expect(result.value).not.toBeNull();
    });
  });

  describe("findById", () => {
    it("should find an invitation by ID", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Find By ID Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "findme@example.com",
        { tier: "admin" },
        testUserId,
      );
      assertSuccess(createResult);

      const result = await repository.findById(createResult.value.id);

      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value?.id).toBe(createResult.value.id);
      expect(result.value?.email).toBe("findme@example.com");
      expect(result.value?.tier).toBe("admin");
    });

    it("should return null for non-existent ID", async () => {
      const result = await repository.findById(faker.string.uuid());

      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("listByResource", () => {
    it("should list pending invitations with enriched data", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "List Enriched Test",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        experiment.id,
        "list1@example.com",
        { tier: "viewer" },
        testUserId,
      );
      await repository.create(
        "experiment",
        experiment.id,
        "list2@example.com",
        { tier: "admin" },
        testUserId,
      );

      const result = await repository.listByResource("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);

      const emails = result.value.map((inv) => inv.email);
      expect(emails).toContain("list1@example.com");
      expect(emails).toContain("list2@example.com");
    });

    it("should include inviter name and resource name", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Enriched Fields Test",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        experiment.id,
        "enriched@example.com",
        { tier: "viewer" },
        testUserId,
      );

      const result = await repository.listByResource("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].resourceName).toBe("Enriched Fields Test");
      expect(result.value[0].invitedByName).toBeDefined();
    });

    it("should not include revoked invitations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "List Excludes Revoked",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "willrevoke@example.com",
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);
      await repository.revoke(createResult.value.id);

      await repository.create(
        "experiment",
        experiment.id,
        "stillpending@example.com",
        { tier: "viewer" },
        testUserId,
      );

      const result = await repository.listByResource("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].email).toBe("stillpending@example.com");
    });

    it("should return empty array for resource with no invitations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Empty List Test",
        userId: testUserId,
      });

      const result = await repository.listByResource("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should return undefined invitedByName when inviter has no profile", async () => {
      // Create a user without a profile
      const noProfileUserId = await testApp.createTestUser({ createProfile: false });

      const { experiment } = await testApp.createExperiment({
        name: "No Profile Inviter Test",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        experiment.id,
        "no-profile-inviter@example.com",
        { tier: "viewer" },
        noProfileUserId,
      );

      const result = await repository.listByResource("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].invitedByName).toBeUndefined();
      expect(result.value[0].resourceName).toBe("No Profile Inviter Test");
    });

    it("should not return invitations from a different resource", async () => {
      const { experiment: exp1 } = await testApp.createExperiment({
        name: "Resource A",
        userId: testUserId,
      });
      const { experiment: exp2 } = await testApp.createExperiment({
        name: "Resource B",
        userId: testUserId,
      });

      await repository.create(
        "experiment",
        exp1.id,
        "only-a@example.com",
        { tier: "viewer" },
        testUserId,
      );

      const result = await repository.listByResource("experiment", exp2.id);

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });

  describe("revoke", () => {
    it("should set invitation status to revoked", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Revoke Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "revoke@example.com",
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);

      const revokeResult = await repository.revoke(createResult.value.id);
      assertSuccess(revokeResult);

      const findResult = await repository.findById(createResult.value.id);
      assertSuccess(findResult);
      expect(findResult.value?.status).toBe("revoked");
    });
  });

  describe("findResourceName", () => {
    it("should return experiment name for experiment resource", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "My Experiment Name",
        userId: testUserId,
      });

      const result = await repository.findResourceName("experiment", experiment.id);

      assertSuccess(result);
      expect(result.value).toBe("My Experiment Name");
    });

    it("should return failure when experiment is not found", async () => {
      const result = await repository.findResourceName("experiment", faker.string.uuid());

      assertFailure(result);
    });
  });

  describe("findPendingByEmail", () => {
    it("should find all pending invitations for an email", async () => {
      const email = "multi@example.com";

      const { experiment: exp1 } = await testApp.createExperiment({
        name: "Pending Email Exp 1",
        userId: testUserId,
      });
      const { experiment: exp2 } = await testApp.createExperiment({
        name: "Pending Email Exp 2",
        userId: testUserId,
      });

      await repository.create("experiment", exp1.id, email, { tier: "viewer" }, testUserId);
      await repository.create("experiment", exp2.id, email, { tier: "admin" }, testUserId);

      const result = await repository.findPendingByEmail(email);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);
    });

    it("should return empty array when no pending invitations exist", async () => {
      const result = await repository.findPendingByEmail("nobody@example.com");

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should not return revoked invitations", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Pending Excludes Revoked",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "partialrevoke@example.com",
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);
      await repository.revoke(createResult.value.id);

      const result = await repository.findPendingByEmail("partialrevoke@example.com");

      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });
  });

  describe("acceptInvitation", () => {
    it("accepts a stored 'viewer' invitation as a 'viewer' grant", async () => {
      const inviteeEmail = "accept@example.com";
      const { experiment } = await testApp.createExperiment({
        name: "Accept Invitation Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);

      const [storedInvitation] = await testApp.database
        .select({ role: invitations.role })
        .from(invitations)
        .where(eq(invitations.id, createResult.value.id));
      expect(storedInvitation.role).toBe("viewer");

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });

      const acceptResult = await repository.acceptInvitation(
        createResult.value.id,
        newUserId,
        "experiment",
        experiment.id,
        { tier: createResult.value.tier },
        testUserId,
      );

      assertSuccess(acceptResult);
      expect(acceptResult.value).toBe("accepted");

      const [grant] = await testApp.database
        .select({ role: resourceGrants.role })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, newUserId),
          ),
        );
      expect(grant.role).toBe("viewer");

      // Verify invitation status changed
      const findResult = await repository.findById(createResult.value.id);
      assertSuccess(findResult);
      expect(findResult.value?.status).toBe("accepted");

      // Verify no longer appears in pending
      const pendingResult = await repository.findPendingByEmail(inviteeEmail);
      assertSuccess(pendingResult);
      expect(pendingResult.value).toHaveLength(0);
    });

    it("should handle duplicate experiment member gracefully", async () => {
      const inviteeEmail = "duplicate@example.com";
      const { experiment } = await testApp.createExperiment({
        name: "Duplicate Member Test",
        userId: testUserId,
      });

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });

      // Add as member first
      await testApp.addExperimentCollaborator(experiment.id, newUserId);

      // Create and accept invitation for same user
      const createResult = await repository.create(
        "experiment",
        experiment.id,
        inviteeEmail,
        { tier: "viewer" },
        testUserId,
      );
      assertSuccess(createResult);

      // Should not throw due to onConflictDoNothing
      const acceptResult = await repository.acceptInvitation(
        createResult.value.id,
        newUserId,
        "experiment",
        experiment.id,
        { tier: "viewer" },
        testUserId,
      );

      assertSuccess(acceptResult);
    });

    it("should accept multiple invitations for the same email across experiments", async () => {
      const inviteeEmail = "multi-accept@example.com";

      const { experiment: exp1 } = await testApp.createExperiment({
        name: "Multi Accept 1",
        userId: testUserId,
      });
      const { experiment: exp2 } = await testApp.createExperiment({
        name: "Multi Accept 2",
        userId: testUserId,
      });

      const create1 = await repository.create(
        "experiment",
        exp1.id,
        inviteeEmail,
        { tier: "viewer" },
        testUserId,
      );
      const create2 = await repository.create(
        "experiment",
        exp2.id,
        inviteeEmail,
        { tier: "admin" },
        testUserId,
      );
      assertSuccess(create1);
      assertSuccess(create2);

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });

      const accept1 = await repository.acceptInvitation(
        create1.value.id,
        newUserId,
        "experiment",
        exp1.id,
        { tier: "viewer" },
        testUserId,
      );
      const accept2 = await repository.acceptInvitation(
        create2.value.id,
        newUserId,
        "experiment",
        exp2.id,
        { tier: "admin" },
        testUserId,
      );

      assertSuccess(accept1);
      assertSuccess(accept2);

      // Both should now be accepted
      const pending = await repository.findPendingByEmail(inviteeEmail);
      assertSuccess(pending);
      expect(pending.value).toHaveLength(0);
    });
  });
});
