/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  ExperimentJoinRequest,
  ExperimentJoinRequestList,
  ExperimentMemberList,
} from "@repo/api/domains/experiment/experiment.schema";
import type { ErrorResponse } from "@repo/api/shared/errors";

import { success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import type { EmailPort } from "../core/ports/email.port";
import { EMAIL_PORT } from "../core/ports/email.port";

describe("ExperimentJoinRequestsController", () => {
  const testApp = TestHarness.App;
  let adminUserId: string;
  let requesterUserId: string;
  let emailPort: EmailPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adminUserId = await testApp.createTestUser({ email: "admin@example.com" });
    requesterUserId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Joe Requester",
    });
    emailPort = testApp.module.get(EMAIL_PORT);
    // Default: every email port call resolves successfully
    vi.spyOn(emailPort, "sendJoinRequestSubmittedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailPort, "sendJoinRequestRejectedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailPort, "sendAddedUserNotification").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createJoinRequest", () => {
    it("creates a pending request on a public experiment and emails admins", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Public exp",
        userId: adminUserId,
        visibility: "public",
      });

      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(path)
        .withAuth(requesterUserId)
        .send({ message: "let me in" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        status: "pending",
        experimentId: experiment.id,
        message: "let me in",
      });
      expect(response.body.user.id).toBe(requesterUserId);

      expect(emailPort.sendJoinRequestSubmittedNotification).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        expect.any(String),
        "admin@example.com",
        "let me in",
      );
    });

    it("returns the existing pending request on duplicate submit (dedup)", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Dedup exp",
        userId: adminUserId,
        visibility: "public",
      });

      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });

      const first: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(path)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const second: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(path)
        .withAuth(requesterUserId)
        .send({ message: "different message" })
        .expect(StatusCodes.CREATED);

      expect(second.body.id).toBe(first.body.id);
    });

    it("returns 403 for private experiments", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Private exp",
        userId: adminUserId,
        visibility: "private",
      });

      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.FORBIDDEN)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not open to join requests");
        });
    });

    it("returns 403 for archived experiments", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Archived exp",
        userId: adminUserId,
        visibility: "public",
        status: "archived",
      });

      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });

      await testApp.post(path).withAuth(requesterUserId).send({}).expect(StatusCodes.FORBIDDEN);
    });

    it("returns 409 when the user is already a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member exp",
        userId: adminUserId,
        visibility: "public",
      });
      await testApp.addExperimentMember(experiment.id, requesterUserId, "member");

      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });

      await testApp.post(path).withAuth(requesterUserId).send({}).expect(StatusCodes.CONFLICT);
    });

    it("returns 404 for missing experiments", async () => {
      const path = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: faker.string.uuid(),
      });

      await testApp.post(path).withAuth(requesterUserId).send({}).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("approveJoinRequest", () => {
    it("approves the request, adds the requester as a member, and sends the membership email", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Approve exp",
        userId: adminUserId,
        visibility: "public",
      });

      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const approvePath = testApp.resolvePath(contract.experiments.approveJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });

      const approveResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(approvePath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(approveResponse.body.status).toBe("approved");
      expect(approveResponse.body.decidedBy).toBe(adminUserId);

      // Requester is now a member
      const listMembersPath = testApp.resolvePath(contract.experiments.listExperimentMembers.path, {
        id: experiment.id,
      });
      const listMembersResponse: SuperTestResponse<ExperimentMemberList> = await testApp
        .get(listMembersPath)
        .withAuth(adminUserId)
        .expect(StatusCodes.OK);
      const memberIds = listMembersResponse.body.map((m) => m.user.id);
      expect(memberIds).toContain(requesterUserId);

      // Standard membership-change email fires
      expect(emailPort.sendAddedUserNotification).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        expect.any(String),
        "member",
        "requester@example.com",
      );
    });

    it("returns 403 when a non-admin attempts to approve", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Non-admin approve exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const approvePath = testApp.resolvePath(contract.experiments.approveJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(approvePath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
    });

    it("returns 409 and closes the request when the requester is already a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member approve exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      await testApp.addExperimentMember(experiment.id, requesterUserId, "member");
      vi.mocked(emailPort).sendAddedUserNotification.mockClear();

      const approvePath = testApp.resolvePath(contract.experiments.approveJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(approvePath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.CONFLICT)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("already a member");
        });

      const mePath = testApp.resolvePath(contract.experiments.getMyJoinRequest.path, {
        id: experiment.id,
      });
      await testApp.get(mePath).withAuth(requesterUserId).expect(StatusCodes.NOT_FOUND);
      expect(vi.mocked(emailPort).sendAddedUserNotification.mock.calls).toHaveLength(0);
    });
  });

  describe("rejectJoinRequest", () => {
    it("marks the request rejected and sends the rejection email", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Reject exp",
        userId: adminUserId,
        visibility: "public",
      });

      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const rejectPath = testApp.resolvePath(contract.experiments.rejectJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });

      const rejectResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(rejectPath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(rejectResponse.body.status).toBe("rejected");

      expect(emailPort.sendJoinRequestRejectedNotification).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        "requester@example.com",
      );
    });

    it("returns 409 and closes the request when the requester is already a member", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member reject exp",
        userId: adminUserId,
        visibility: "public",
      });

      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      await testApp.addExperimentMember(experiment.id, requesterUserId, "member");
      vi.mocked(emailPort).sendJoinRequestRejectedNotification.mockClear();

      const rejectPath = testApp.resolvePath(contract.experiments.rejectJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(rejectPath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.CONFLICT)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("already a member");
        });

      const mePath = testApp.resolvePath(contract.experiments.getMyJoinRequest.path, {
        id: experiment.id,
      });
      await testApp.get(mePath).withAuth(requesterUserId).expect(StatusCodes.NOT_FOUND);
      expect(vi.mocked(emailPort).sendJoinRequestRejectedNotification.mock.calls).toHaveLength(0);
    });
  });

  describe("cancelJoinRequest", () => {
    it("lets the requester cancel their own pending request", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Cancel exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const cancelPath = testApp.resolvePath(contract.experiments.cancelJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp.delete(cancelPath).withAuth(requesterUserId).expect(StatusCodes.NO_CONTENT);

      // No pending request anymore
      const mePath = testApp.resolvePath(contract.experiments.getMyJoinRequest.path, {
        id: experiment.id,
      });
      await testApp.get(mePath).withAuth(requesterUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("returns 403 when a different user tries to cancel a request", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Cancel-foreign exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const otherUserId = await testApp.createTestUser({ email: "other@example.com" });

      const cancelPath = testApp.resolvePath(contract.experiments.cancelJoinRequest.path, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp.delete(cancelPath).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("listJoinRequests", () => {
    it("returns pending requests to any authenticated user", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "List exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolvePath(contract.experiments.createJoinRequest.path, {
        id: experiment.id,
      });
      await testApp.post(createPath).withAuth(requesterUserId).send({}).expect(StatusCodes.CREATED);

      const listPath = testApp.resolvePath(contract.experiments.listJoinRequests.path, {
        id: experiment.id,
      });

      const listResponse: SuperTestResponse<ExperimentJoinRequestList> = await testApp
        .get(listPath)
        .withAuth(adminUserId)
        .expect(StatusCodes.OK);
      expect(listResponse.body).toHaveLength(1);

      // Any user can list, regardless of membership
      const otherUserId = await testApp.createTestUser({ email: "other-list@example.com" });
      await testApp.get(listPath).withAuth(otherUserId).expect(StatusCodes.OK);
    });
  });
});
