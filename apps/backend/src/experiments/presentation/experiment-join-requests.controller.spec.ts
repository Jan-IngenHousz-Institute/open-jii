/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ExperimentContributors } from "@repo/api/domains/experiment/contributors/experiment-contributors.schema";
import type {
  ExperimentJoinRequest,
  ExperimentJoinRequestList,
} from "@repo/api/domains/experiment/join-requests/experiment-join-requests.schema";
import type { ErrorResponse } from "@repo/api/shared/errors";

import { AuthorizationService } from "../../authorization/authorization.service";
import { EmailVisibilityService } from "../../authorization/email-visibility.service";
import { EmailAdapter } from "../../common/modules/email/services/email.adapter";
import { success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ExperimentJoinRequestRepository } from "../core/repositories/experiment-join-request.repository";

describe("ExperimentJoinRequestsController", () => {
  const testApp = TestHarness.App;
  let adminUserId: string;
  let requesterUserId: string;
  let emailAdapter: EmailAdapter;

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
    emailAdapter = testApp.module.get(EmailAdapter);
    // Default: every notification email resolves successfully
    vi.spyOn(emailAdapter, "sendJoinRequestSubmittedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailAdapter, "sendJoinRequestRejectedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailAdapter, "sendAccessGrantedNotification").mockResolvedValue(success(undefined));
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

      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
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

      expect(emailAdapter.sendJoinRequestSubmittedNotification).toHaveBeenCalledWith(
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

      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
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

      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
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

      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });

      await testApp.post(path).withAuth(requesterUserId).send({}).expect(StatusCodes.FORBIDDEN);
    });

    it("returns 409 when the user already collaborates on the experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member exp",
        userId: adminUserId,
        visibility: "public",
      });
      await testApp.addExperimentCollaborator(experiment.id, requesterUserId);

      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });

      await testApp.post(path).withAuth(requesterUserId).send({}).expect(StatusCodes.CONFLICT);
    });

    it("returns 404 for missing experiments", async () => {
      const path = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
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

      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const approvePath = testApp.resolveOrpcPath(contract.experiments.approveJoinRequest, {
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

      // The requester now holds a grant, so they are credited as a contributor
      const contributorsPath = testApp.resolveOrpcPath(
        contract.experiments.listExperimentContributors,
        { id: experiment.id },
      );
      const contributorsResponse: SuperTestResponse<ExperimentContributors> = await testApp
        .get(contributorsPath)
        .withAuth(adminUserId)
        .expect(StatusCodes.OK);
      expect(contributorsResponse.body.contributors.map((c) => c.userId)).toContain(
        requesterUserId,
      );

      // Standard membership-change email fires
      expect(emailAdapter.sendAccessGrantedNotification).toHaveBeenCalledWith({
        resourceType: "experiment",
        resourceId: experiment.id,
        resourceName: experiment.name,
        actor: expect.any(String) as string,
        // Approval hands out the contributing tier, never an administering one.
        role: "a contributor who can view and add data",
        email: "requester@example.com",
      });
    });

    it("returns 403 when a non-admin attempts to approve", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Non-admin approve exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const approvePath = testApp.resolveOrpcPath(contract.experiments.approveJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(approvePath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
    });

    it("returns 409 and closes the request when the requester already has access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member approve exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      await testApp.addExperimentCollaborator(experiment.id, requesterUserId);
      vi.mocked(emailAdapter).sendAccessGrantedNotification.mockClear();

      const approvePath = testApp.resolveOrpcPath(contract.experiments.approveJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(approvePath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.CONFLICT)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("already has access");
        });

      const mePath = testApp.resolveOrpcPath(contract.experiments.getMyJoinRequest, {
        id: experiment.id,
      });
      await testApp.get(mePath).withAuth(requesterUserId).expect(StatusCodes.NOT_FOUND);
      expect(vi.mocked(emailAdapter).sendAccessGrantedNotification.mock.calls).toHaveLength(0);
    });
  });

  describe("rejectJoinRequest", () => {
    it("marks the request rejected and sends the rejection email", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Reject exp",
        userId: adminUserId,
        visibility: "public",
      });

      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const rejectPath = testApp.resolveOrpcPath(contract.experiments.rejectJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });

      const rejectResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(rejectPath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(rejectResponse.body.status).toBe("rejected");

      expect(emailAdapter.sendJoinRequestRejectedNotification).toHaveBeenCalledWith(
        experiment.id,
        experiment.name,
        "requester@example.com",
      );
    });

    it("returns 409 and closes the request when the requester already has access", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Already member reject exp",
        userId: adminUserId,
        visibility: "public",
      });

      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      await testApp.addExperimentCollaborator(experiment.id, requesterUserId);
      vi.mocked(emailAdapter).sendJoinRequestRejectedNotification.mockClear();

      const rejectPath = testApp.resolveOrpcPath(contract.experiments.rejectJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp
        .post(rejectPath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.CONFLICT)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("already has access");
        });

      const mePath = testApp.resolveOrpcPath(contract.experiments.getMyJoinRequest, {
        id: experiment.id,
      });
      await testApp.get(mePath).withAuth(requesterUserId).expect(StatusCodes.NOT_FOUND);
      expect(vi.mocked(emailAdapter).sendJoinRequestRejectedNotification.mock.calls).toHaveLength(
        0,
      );
    });
  });

  it.each(["approve", "reject"] as const)(
    "keeps a committed %s successful and hides email when the visibility read fails",
    async (decision) => {
      const { experiment } = await testApp.createExperiment({
        name: "Decision visibility failure",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const created: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);
      vi.spyOn(
        testApp.module.get(EmailVisibilityService),
        "visibleUserEmails",
      ).mockRejectedValueOnce(new Error("Visibility read unavailable"));
      const decisionPath = testApp.resolveOrpcPath(
        decision === "approve"
          ? contract.experiments.approveJoinRequest
          : contract.experiments.rejectJoinRequest,
        { id: experiment.id, requestId: created.body.id },
      );

      const response: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(decisionPath)
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.OK);

      const status = decision === "approve" ? "approved" : "rejected";
      expect(response.body).toMatchObject({ status, user: { id: requesterUserId, email: null } });
      expect(JSON.stringify(response.body)).not.toContain("requester@example.com");
      const persisted = await testApp.module
        .get(ExperimentJoinRequestRepository)
        .findById(created.body.id);
      expect(persisted.isSuccess() && persisted.value).toMatchObject({ status });
      const access = await testApp.module.get(AuthorizationService).can(requesterUserId, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action: "contribute",
      });
      expect(access.allow).toBe(decision === "approve");
    },
  );

  describe("cancelJoinRequest", () => {
    it("lets the requester cancel their own pending request", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Cancel exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const cancelPath = testApp.resolveOrpcPath(contract.experiments.cancelJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp.delete(cancelPath).withAuth(requesterUserId).expect(StatusCodes.NO_CONTENT);

      // No pending request anymore
      const mePath = testApp.resolveOrpcPath(contract.experiments.getMyJoinRequest, {
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
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(createPath)
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);

      const otherUserId = await testApp.createTestUser({ email: "other@example.com" });

      const cancelPath = testApp.resolveOrpcPath(contract.experiments.cancelJoinRequest, {
        id: experiment.id,
        requestId: createResponse.body.id,
      });
      await testApp.delete(cancelPath).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("listJoinRequests", () => {
    it("returns pending requests to admins and rejects other authenticated users", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "List exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      await testApp.post(createPath).withAuth(requesterUserId).send({}).expect(StatusCodes.CREATED);

      const listPath = testApp.resolveOrpcPath(contract.experiments.listJoinRequests, {
        id: experiment.id,
      });

      const listResponse: SuperTestResponse<ExperimentJoinRequestList> = await testApp
        .get(listPath)
        .withAuth(adminUserId)
        .expect(StatusCodes.OK);
      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].user.email).toBe("requester@example.com");

      const otherUserId = await testApp.createTestUser({ email: "other-list@example.com" });
      await testApp.get(listPath).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("requester addresses", () => {
    it("are out of a viewer's reach: the list is refused", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Scoped exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createPath = testApp.resolveOrpcPath(contract.experiments.createJoinRequest, {
        id: experiment.id,
      });
      await testApp.post(createPath).withAuth(requesterUserId).send({}).expect(StatusCodes.CREATED);
      const viewerId = await testApp.createTestUser({ email: "viewer@example.com" });
      await testApp.addExperimentCollaborator(experiment.id, viewerId);

      await testApp
        .get(testApp.resolveOrpcPath(contract.experiments.listJoinRequests, { id: experiment.id }))
        .withAuth(viewerId)
        .expect(StatusCodes.FORBIDDEN);
    });

    it("leave the decided request once it is no longer pending", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Decided exp",
        userId: adminUserId,
        visibility: "public",
      });
      const createResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.experiments.createJoinRequest, { id: experiment.id }),
        )
        .withAuth(requesterUserId)
        .send({})
        .expect(StatusCodes.CREATED);
      expect(createResponse.body.user.email).toBe("requester@example.com");

      const rejectResponse: SuperTestResponse<ExperimentJoinRequest> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.experiments.rejectJoinRequest, {
            id: experiment.id,
            requestId: createResponse.body.id,
          }),
        )
        .withAuth(adminUserId)
        .send({})
        .expect(StatusCodes.OK);

      expect(rejectResponse.body.status).toBe("rejected");
      expect(rejectResponse.body.user.email).toBeNull();
    });
  });

  describe("authorization", () => {
    it.each([
      {
        name: "list join requests",
        request: (experimentId: string, userId: string) =>
          testApp
            .get(
              testApp.resolveOrpcPath(contract.experiments.listJoinRequests, {
                id: experimentId,
              }),
            )
            .withAuth(userId),
      },
      {
        name: "approve join request",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.approveJoinRequest, {
                id: experimentId,
                requestId: faker.string.uuid(),
              }),
            )
            .withAuth(userId),
      },
      {
        name: "reject join request",
        request: (experimentId: string, userId: string) =>
          testApp
            .post(
              testApp.resolveOrpcPath(contract.experiments.rejectJoinRequest, {
                id: experimentId,
                requestId: faker.string.uuid(),
              }),
            )
            .withAuth(userId),
      },
    ])("requires manage access to $name", async ({ request }) => {
      const { experiment } = await testApp.createExperiment({
        name: "Guarded private experiment",
        userId: adminUserId,
        visibility: "private",
      });
      const canSpy = vi.spyOn(testApp.module.get(AuthorizationService), "can");

      await request(experiment.id, requesterUserId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledTimes(1);
      expect(canSpy).toHaveBeenCalledWith(requesterUserId, {
        resourceType: "experiment",
        resourceId: experiment.id,
        action: "manage",
      });
    });
  });
});
