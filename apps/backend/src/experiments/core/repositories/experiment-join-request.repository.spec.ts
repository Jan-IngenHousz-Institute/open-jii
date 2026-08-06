import {
  and,
  createSecondaryDatabase,
  eq,
  experimentJoinRequests,
  profiles,
  resourceGrants,
} from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "./experiment-join-request.repository";

describe("ExperimentJoinRequestRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentJoinRequestRepository;
  let adminUserId: string;
  let requesterUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({});
    requesterUserId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Joe Requester",
    });
    repository = testApp.module.get(ExperimentJoinRequestRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create + findPendingByExperimentAndUser", () => {
    it("creates a pending request and returns it with requester profile", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Public experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const createResult = await repository.create(
        experiment.id,
        requesterUserId,
        "please let me in",
      );
      assertSuccess(createResult);
      expect(createResult.value.status).toBe("pending");
      expect(createResult.value.message).toBe("please let me in");
      expect(createResult.value.user.id).toBe(requesterUserId);

      const findResult = await repository.findPendingByExperimentAndUser(
        experiment.id,
        requesterUserId,
      );
      assertSuccess(findResult);
      expect(findResult.value?.id).toBe(createResult.value.id);
    });

    it("returns null when no pending request exists", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Another experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const result = await repository.findPendingByExperimentAndUser(
        experiment.id,
        requesterUserId,
      );
      assertSuccess(result);
      expect(result.value).toBeNull();
    });
  });

  describe("approve", () => {
    it("marks the request approved and grants the requester viewer access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "To-approve experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const createResult = await repository.create(experiment.id, requesterUserId, undefined);
      assertSuccess(createResult);

      const approveResult = await repository.approve(
        createResult.value.id,
        requesterUserId,
        experiment.id,
        adminUserId,
      );
      assertSuccess(approveResult);
      expect(approveResult.value.outcome).toBe("approved");
      if (approveResult.value.outcome !== "approved") {
        throw new Error("Expected approval to win the pending request claim");
      }
      expect(approveResult.value.request.status).toBe("approved");
      expect(approveResult.value.request.decidedBy).toBe(adminUserId);

      const [grant] = await testApp.database
        .select({ role: resourceGrants.role })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, requesterUserId),
          ),
        );
      expect(grant.role).toBe("viewer");

      // No more pending request
      const pending = await repository.findPendingByExperimentAndUser(
        experiment.id,
        requesterUserId,
      );
      assertSuccess(pending);
      expect(pending.value).toBeNull();
    });

    it("leaves an existing admin grant unchanged", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already promoted experiment",
        userId: adminUserId,
        visibility: "public",
      });
      const createResult = await repository.create(experiment.id, requesterUserId, undefined);
      assertSuccess(createResult);
      await testApp.addExperimentAdmin(experiment.id, requesterUserId);

      const approveResult = await repository.approve(
        createResult.value.id,
        requesterUserId,
        experiment.id,
        adminUserId,
      );

      assertSuccess(approveResult);
      expect(approveResult.value.outcome).toBe("approved");
      const [grant] = await testApp.database
        .select({ role: resourceGrants.role })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experiment.id),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, requesterUserId),
          ),
        );
      expect(grant.role).toBe("admin");
    });

    it("lets exactly one concurrent approval claim a pending request", async () => {
      const secondary = createSecondaryDatabase();
      try {
        const secondaryRepository = new ExperimentJoinRequestRepository(secondary.database);
        const secondAdminUserId = await testApp.createTestUser({});
        const { experiment } = await testApp.createExperiment({
          name: "Concurrently approved experiment",
          userId: adminUserId,
          visibility: "public",
        });
        const createResult = await repository.create(experiment.id, requesterUserId, undefined);
        assertSuccess(createResult);

        const outcomes = await Promise.all([
          repository.approve(createResult.value.id, requesterUserId, experiment.id, adminUserId),
          secondaryRepository.approve(
            createResult.value.id,
            requesterUserId,
            experiment.id,
            secondAdminUserId,
          ),
        ]);

        const resolvedOutcomes = outcomes.map((result) => {
          assertSuccess(result);
          return result.value.outcome;
        });
        expect(resolvedOutcomes.sort()).toEqual(["approved", "not-pending"]);
        const [decision] = await testApp.database
          .select({
            status: experimentJoinRequests.status,
            decidedBy: experimentJoinRequests.decidedBy,
          })
          .from(experimentJoinRequests)
          .where(eq(experimentJoinRequests.id, createResult.value.id));
        expect(decision.status).toBe("approved");
        expect([adminUserId, secondAdminUserId]).toContain(decision.decidedBy);
      } finally {
        await secondary.close();
      }
    });
  });

  describe("markDecided", () => {
    it("transitions a pending request to rejected", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "To-reject experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const createResult = await repository.create(experiment.id, requesterUserId, undefined);
      assertSuccess(createResult);

      const rejectResult = await repository.markDecided(
        createResult.value.id,
        "rejected",
        adminUserId,
      );
      assertSuccess(rejectResult);
      expect(rejectResult.value.status).toBe("rejected");
      expect(rejectResult.value.decidedBy).toBe(adminUserId);
    });
  });

  describe("listPendingByExperiment", () => {
    it("returns only pending requests for the experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Many-request experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const otherRequesterId = await testApp.createTestUser({
        email: "other@example.com",
        name: "Other User",
      });

      const first = await repository.create(experiment.id, requesterUserId, "first");
      assertSuccess(first);
      const second = await repository.create(experiment.id, otherRequesterId, "second");
      assertSuccess(second);

      // Reject the first one — should not appear in pending list
      await repository.markDecided(first.value.id, "rejected", adminUserId);

      const result = await repository.listPendingByExperiment(experiment.id);
      assertSuccess(result);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe(second.value.id);
    });
  });

  describe("listAdminEmails", () => {
    it("returns all admin emails for an experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Admins experiment",
        userId: adminUserId,
        visibility: "public",
      });

      const secondAdminId = await testApp.createTestUser({
        email: "second-admin@example.com",
        name: "Second Admin",
      });
      await testApp.addExperimentAdmin(experiment.id, secondAdminId);

      const nonAdminId = await testApp.createTestUser({
        email: "regular@example.com",
        name: "Regular Member",
      });
      await testApp.addExperimentCollaborator(experiment.id, nonAdminId);

      const result = await repository.listAdminEmails(experiment.id);
      assertSuccess(result);
      expect(result.value).toEqual(expect.arrayContaining(["second-admin@example.com"]));
      expect(result.value).not.toContain("regular@example.com");
    });

    it("notifies the owning org's owner, who holds no grant", async () => {
      const soleOwner = await testApp.createTestUser({
        email: "sole-owner@example.com",
        name: "Sole Owner",
      });
      const { experiment } = await testApp.createExperiment({
        name: "Personal workspace experiment",
        userId: soleOwner,
        visibility: "public",
      });

      const result = await repository.listAdminEmails(experiment.id);
      assertSuccess(result);
      // Sourced from grants alone this would be empty and every join request on a
      // personal-workspace experiment would notify nobody.
      expect(result.value).toEqual(["sole-owner@example.com"]);
    });

    it("mails an owner who also holds an admin grant exactly once", async () => {
      const soleOwner = await testApp.createTestUser({
        email: "double-counted@example.com",
        name: "Owner And Grantee",
      });
      const { experiment } = await testApp.createExperiment({
        name: "Owner with a grant",
        userId: soleOwner,
        visibility: "public",
      });
      await testApp.addExperimentAdmin(experiment.id, soleOwner);

      const result = await repository.listAdminEmails(experiment.id);
      assertSuccess(result);
      expect(result.value).toEqual(["double-counted@example.com"]);
    });

    it("leaves out an owner whose account has been closed", async () => {
      const gone = await testApp.createTestUser({ email: "gone@example.com", name: "Gone" });
      const { experiment } = await testApp.createExperiment({
        name: "Husk experiment",
        userId: gone,
        visibility: "public",
      });
      const keeper = await testApp.createTestUser({ email: "keeper@example.com", name: "Keeper" });
      await testApp.addExperimentAdmin(experiment.id, keeper);
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, gone));

      const result = await repository.listAdminEmails(experiment.id);
      assertSuccess(result);
      // A closed account's mailbox is scrubbed; the admin grant holder is who is
      // left to decide the request.
      expect(result.value).toEqual(["keeper@example.com"]);
    });
  });
});
