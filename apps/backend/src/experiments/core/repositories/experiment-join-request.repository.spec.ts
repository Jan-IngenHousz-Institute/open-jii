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
    it("marks the request approved and adds the requester as a member", async () => {
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
      expect(approveResult.value.status).toBe("approved");
      expect(approveResult.value.decidedBy).toBe(adminUserId);

      // No more pending request
      const pending = await repository.findPendingByExperimentAndUser(
        experiment.id,
        requesterUserId,
      );
      assertSuccess(pending);
      expect(pending.value).toBeNull();
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
      await testApp.addExperimentMember(experiment.id, secondAdminId, "admin");

      const nonAdminId = await testApp.createTestUser({
        email: "regular@example.com",
        name: "Regular Member",
      });
      await testApp.addExperimentMember(experiment.id, nonAdminId, "member");

      const result = await repository.listAdminEmails(experiment.id);
      assertSuccess(result);
      expect(result.value).toEqual(expect.arrayContaining(["second-admin@example.com"]));
      expect(result.value).not.toContain("regular@example.com");
    });
  });
});
