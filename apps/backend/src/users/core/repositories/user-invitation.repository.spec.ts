import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../common/utils/fp-utils";
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
        "member",
        testUserId,
      );

      assertSuccess(result);
      expect(result.value).toMatchObject({
        resourceType: "experiment",
        resourceId: experiment.id,
        email: "invite@example.com",
        role: "member",
        status: "pending",
        invitedBy: testUserId,
      });
      expect(result.value.id).toBeDefined();
      expect(result.value.createdAt).toBeDefined();
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
        "member",
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
        "member",
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
        "member",
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
        "member",
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
        "admin",
        testUserId,
      );
      assertSuccess(createResult);

      const result = await repository.findById(createResult.value.id);

      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value?.id).toBe(createResult.value.id);
      expect(result.value?.email).toBe("findme@example.com");
      expect(result.value?.role).toBe("admin");
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
        "member",
        testUserId,
      );
      await repository.create(
        "experiment",
        experiment.id,
        "list2@example.com",
        "admin",
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
        "member",
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
        "member",
        testUserId,
      );
      assertSuccess(createResult);
      await repository.revoke(createResult.value.id);

      await repository.create(
        "experiment",
        experiment.id,
        "stillpending@example.com",
        "member",
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
        "member",
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

      await repository.create("experiment", exp1.id, "only-a@example.com", "member", testUserId);

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
        "member",
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

  describe("updateRole", () => {
    it("should update the role on a pending invitation", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Update Role Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "role@example.com",
        "member",
        testUserId,
      );
      assertSuccess(createResult);

      const updateResult = await repository.updateRole(createResult.value.id, "admin");

      assertSuccess(updateResult);
      expect(updateResult.value.role).toBe("admin");
    });

    it("should not update role on a revoked invitation", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Update Revoked Role",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        "revokedrole@example.com",
        "member",
        testUserId,
      );
      assertSuccess(createResult);

      await repository.revoke(createResult.value.id);

      const updateResult = await repository.updateRole(createResult.value.id, "admin");

      assertSuccess(updateResult);
      // The returning will be undefined since no rows matched the pending status filter
      expect(updateResult.value).toBeUndefined();
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

    it("should return fallback when experiment is not found", async () => {
      const result = await repository.findResourceName("experiment", faker.string.uuid());

      assertSuccess(result);
      expect(result.value).toBe("an experiment");
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

      await repository.create("experiment", exp1.id, email, "member", testUserId);
      await repository.create("experiment", exp2.id, email, "admin", testUserId);

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
        "member",
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
    it("should mark invitation as accepted and add experiment member", async () => {
      const inviteeEmail = "accept@example.com";
      const { experiment } = await testApp.createExperiment({
        name: "Accept Invitation Test",
        userId: testUserId,
      });

      const createResult = await repository.create(
        "experiment",
        experiment.id,
        inviteeEmail,
        "member",
        testUserId,
      );
      assertSuccess(createResult);

      const newUserId = await testApp.createTestUser({ email: inviteeEmail });

      const acceptResult = await repository.acceptInvitation(
        createResult.value.id,
        newUserId,
        "experiment",
        experiment.id,
        "member",
      );

      assertSuccess(acceptResult);

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
      await testApp.addExperimentMember(experiment.id, newUserId, "member");

      // Create and accept invitation for same user
      const createResult = await repository.create(
        "experiment",
        experiment.id,
        inviteeEmail,
        "member",
        testUserId,
      );
      assertSuccess(createResult);

      // Should not throw due to onConflictDoNothing
      const acceptResult = await repository.acceptInvitation(
        createResult.value.id,
        newUserId,
        "experiment",
        experiment.id,
        "member",
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
        "member",
        testUserId,
      );
      const create2 = await repository.create(
        "experiment",
        exp2.id,
        inviteeEmail,
        "admin",
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
        "member",
      );
      const accept2 = await repository.acceptInvitation(
        create2.value.id,
        newUserId,
        "experiment",
        exp2.id,
        "admin",
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
