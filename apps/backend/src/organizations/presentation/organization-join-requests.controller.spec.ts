/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  OrganizationJoinRequest,
  OrganizationJoinRequestList,
} from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import {
  createSecondaryDatabase,
  and,
  eq,
  notifications,
  organizationJoinRequests,
  organizationMembers,
  organizations,
} from "@repo/database";

import { EmailVisibilityService } from "../../authorization/email-visibility.service";
import { EmailAdapter } from "../../common/modules/email/services/email.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../notifications/application/services/notification-dispatch.service";
import { NotificationDeliveryRepository } from "../../notifications/core/repositories/notification-delivery.repository";
import { backendPidOf, waitUntilBlocked } from "../../test/lock-wait";
import { queuedDeliveriesFor } from "../../test/notification-deliveries";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { OrganizationJoinRequestRepository } from "../core/repositories/organization-join-request.repository";
import { OrganizationRepository } from "../core/repositories/organization.repository";

describe("OrganizationJoinRequestsController", () => {
  const testApp = TestHarness.App;
  let ownerId: string;
  let adminId: string;
  let plainMemberId: string;
  let requesterId: string;
  let emailAdapter: EmailAdapter;

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const allRows = () => testApp.database.select().from(notifications);

  const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerId = await testApp.createTestUser({ email: "owner@example.com", name: "Olive Owner" });
    adminId = await testApp.createTestUser({ email: "admin@example.com", name: "Adam Admin" });
    plainMemberId = await testApp.createTestUser({
      email: "member@example.com",
      name: "Mel Member",
    });
    requesterId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Rita Requester",
    });

    emailAdapter = testApp.module.get(EmailAdapter);
    vi.spyOn(emailAdapter, "sendOrganizationJoinRequestSubmittedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailAdapter, "sendOrganizationJoinRequestApprovedNotification").mockResolvedValue(
      success(undefined),
    );
    vi.spyOn(emailAdapter, "sendOrganizationJoinRequestRejectedNotification").mockResolvedValue(
      success(undefined),
    );
  });

  /** Makes the next dispatch fail, so a caller sees whether the action still stands. */
  function breakDispatch() {
    vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );
  }

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedOrg(visibility: "private" | "public" = "public") {
    const organizationId = await testApp.createOrganization("Photosynthesis Lab", { visibility });
    await testApp.addOrganizationMember(organizationId, ownerId, "owner");
    await testApp.addOrganizationMember(organizationId, adminId, "admin");
    await testApp.addOrganizationMember(organizationId, plainMemberId, "member");
    return organizationId;
  }

  const createPath = (id: string) =>
    testApp.resolveOrpcPath(contract.organizations.createOrganizationJoinRequest, { id });
  const listPath = (id: string) =>
    testApp.resolveOrpcPath(contract.organizations.listOrganizationJoinRequests, { id });
  const cancelPath = (id: string) =>
    testApp.resolveOrpcPath(contract.organizations.cancelMyOrganizationJoinRequest, { id });
  const decidePath = (id: string, requestId: string) =>
    testApp.resolveOrpcPath(contract.organizations.decideOrganizationJoinRequest, {
      id,
      requestId,
    });

  describe("createOrganizationJoinRequest", () => {
    it("creates a pending request on a public organization and notifies the deciders", async () => {
      const organizationId = await seedOrg("public");

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({ message: "I would like to help" })
        .expect(StatusCodes.CREATED);

      expect(response.body).toMatchObject({
        organizationId,
        status: "pending",
        message: "I would like to help",
      });
      expect(response.body.user.id).toBe(requesterId);

      // Owners and admins decide, so they are who hears; a plain member does not,
      // and neither does the requester who caused it.
      for (const decider of [ownerId, adminId]) {
        expect(await rowsFor(decider)).toMatchObject([
          {
            type: "organization_join_request_received",
            actorId: requesterId,
            resourceType: "organization",
            resourceId: organizationId,
            params: { organizationName: "Photosynthesis Lab", message: "I would like to help" },
          },
        ]);
      }
      expect(await rowsFor(plainMemberId)).toEqual([]);
      expect(await rowsFor(requesterId)).toEqual([]);

      // One email owed per decider, and none sent from inside the request.
      for (const decider of [ownerId, adminId]) {
        expect(await deliveriesFor(decider)).toMatchObject([
          { type: "organization_join_request_received", channel: "email", status: "pending" },
        ]);
      }
      expect(emailAdapter.sendOrganizationJoinRequestSubmittedNotification).not.toHaveBeenCalled();
    });

    it("is idempotent: a second submit returns the pending request already on file", async () => {
      const organizationId = await seedOrg("public");

      const first: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.CREATED);

      const second: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.CREATED);

      expect(second.body.id).toBe(first.body.id);
      // Only the submit that created the request told anybody: one row per decider.
      expect(await allRows()).toHaveLength(2);
      expect([...(await deliveriesFor(ownerId)), ...(await deliveriesFor(adminId))]).toHaveLength(
        2,
      );
    });

    it("still creates the request when the notification cannot be dispatched", async () => {
      const organizationId = await seedOrg("public");
      breakDispatch();

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.CREATED);

      expect(response.body.status).toBe("pending");
      expect(await allRows()).toEqual([]);
    });

    it("404s a private organization rather than admitting it exists", async () => {
      const organizationId = await seedOrg("private");

      await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });

    it("404s a personal workspace", async () => {
      const personalOrgId = await testApp.personalOrganizationId(ownerId);

      await testApp
        .post(createPath(personalOrgId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });

    it("409s a caller who is already a member", async () => {
      const organizationId = await seedOrg("public");

      await testApp
        .post(createPath(organizationId))
        .withAuth(plainMemberId)
        .send({})
        .expect(StatusCodes.CONFLICT);
    });

    it("refuses when the organization goes private between the check and the insert", async () => {
      const organizationId = await seedOrg("public");
      const organizationRepository = testApp.module.get(OrganizationRepository);
      const publicSnapshot = await organizationRepository.findAccess(organizationId, requesterId);
      await testApp.database
        .update(organizations)
        .set({ visibility: "private" })
        .where(eq(organizations.id, organizationId));
      // Only the pre-check sees the stale public snapshot; the insert's own
      // predicate and the re-read that explains the refusal both see the truth.
      vi.spyOn(organizationRepository, "findAccess").mockResolvedValueOnce(publicSnapshot);

      await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);

      const rows = await testApp.database
        .select({ id: organizationJoinRequests.id })
        .from(organizationJoinRequests)
        .where(eq(organizationJoinRequests.organizationId, organizationId));
      expect(rows).toEqual([]);
    });

    it("waits for a concurrent switch to private and then refuses", async () => {
      const organizationId = await seedOrg("public");
      const repository = testApp.module.get(OrganizationJoinRequestRepository);
      const secondary = createSecondaryDatabase();
      const observer = createSecondaryDatabase();
      let releaseFlip!: () => void;
      const released = new Promise<void>((resolve) => (releaseFlip = resolve));
      let flipped!: () => void;
      const flipHeld = new Promise<void>((resolve) => (flipped = resolve));
      try {
        const flip = secondary.database.transaction(async (tx) => {
          await tx
            .update(organizations)
            .set({ visibility: "private" })
            .where(eq(organizations.id, organizationId));
          flipped();
          await released;
        });
        await flipHeld;
        // The repository runs on the harness's single shared connection.
        const requestPid = await backendPidOf(testApp.database);
        const create = repository.createIfJoinable(organizationId, requesterId, undefined);
        await waitUntilBlocked(observer.database, requestPid);
        releaseFlip();
        await flip;
        const result = await create;
        expect(result.isSuccess() && result.value.outcome).toBe("not-joinable");
      } finally {
        releaseFlip();
        await Promise.all([secondary.close(), observer.close()]);
      }
    });

    it("refuses when the caller becomes a member between the check and the insert", async () => {
      const organizationId = await seedOrg("public");
      const organizationRepository = testApp.module.get(OrganizationRepository);
      const outsiderSnapshot = await organizationRepository.findAccess(organizationId, requesterId);
      await testApp.addOrganizationMember(organizationId, requesterId, "member");
      vi.spyOn(organizationRepository, "findAccess").mockResolvedValueOnce(outsiderSnapshot);

      await testApp
        .post(createPath(organizationId))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.CONFLICT);

      const rows = await testApp.database
        .select({ id: organizationJoinRequests.id })
        .from(organizationJoinRequests)
        .where(eq(organizationJoinRequests.organizationId, organizationId));
      expect(rows).toEqual([]);
    });

    it("404s an organization that does not exist", async () => {
      await testApp
        .post(createPath(faker.string.uuid()))
        .withAuth(requesterId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listOrganizationJoinRequests", () => {
    it("shows owners and admins the queue, pending first", async () => {
      const organizationId = await seedOrg("public");
      const decided = await testApp.createTestUser({ email: "decided@example.com" });
      await testApp.addOrganizationJoinRequest(organizationId, decided, { status: "rejected" });
      await testApp.addOrganizationJoinRequest(organizationId, requesterId);

      for (const decider of [ownerId, adminId]) {
        const response: SuperTestResponse<OrganizationJoinRequestList> = await testApp
          .get(listPath(organizationId))
          .withAuth(decider)
          .expect(StatusCodes.OK);

        expect(response.body.map((request) => request.status)).toEqual(["pending", "rejected"]);
      }
    });

    it("shows a decider the address of a pending requester, not of a rejected one", async () => {
      const organizationId = await seedOrg("public");
      const decided = await testApp.createTestUser({ email: "decided@example.com" });
      await testApp.addOrganizationJoinRequest(organizationId, decided, { status: "rejected" });
      await testApp.addOrganizationJoinRequest(organizationId, requesterId);

      const response: SuperTestResponse<OrganizationJoinRequestList> = await testApp
        .get(listPath(organizationId))
        .withAuth(adminId)
        .expect(StatusCodes.OK);

      expect(response.body.map((request) => request.user.email)).toEqual([
        "requester@example.com",
        null,
      ]);
      expect(JSON.stringify(response.body)).not.toContain("decided@example.com");
    });

    it("403s a plain member", async () => {
      const organizationId = await seedOrg("public");

      await testApp
        .get(listPath(organizationId))
        .withAuth(plainMemberId)
        .expect(StatusCodes.FORBIDDEN);
    });

    it("403s an outsider on a public organization", async () => {
      const organizationId = await seedOrg("public");

      await testApp
        .get(listPath(organizationId))
        .withAuth(requesterId)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("cancelMyOrganizationJoinRequest", () => {
    it("withdraws the caller's own pending request", async () => {
      const organizationId = await seedOrg("public");
      await testApp.addOrganizationJoinRequest(organizationId, requesterId);

      await testApp
        .delete(cancelPath(organizationId))
        .withAuth(requesterId)
        .expect(StatusCodes.NO_CONTENT);

      const remaining: SuperTestResponse<OrganizationJoinRequestList> = await testApp
        .get(listPath(organizationId))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(remaining.body.map((request) => request.status)).toEqual(["cancelled"]);
    });

    it("404s when nothing is pending", async () => {
      const organizationId = await seedOrg("public");

      await testApp
        .delete(cancelPath(organizationId))
        .withAuth(requesterId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("cannot reach somebody else's request", async () => {
      const organizationId = await seedOrg("public");
      const other = await testApp.createTestUser({ email: "other@example.com" });
      await testApp.addOrganizationJoinRequest(organizationId, other);

      await testApp
        .delete(cancelPath(organizationId))
        .withAuth(requesterId)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("decideOrganizationJoinRequest", () => {
    async function seedPendingRequest(organizationId: string, userId = requesterId) {
      const row = await testApp.addOrganizationJoinRequest(organizationId, userId);
      return row.id;
    }

    function membershipRows(organizationId: string, userId: string) {
      return testApp.database
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, userId),
          ),
        );
    }

    it.each([false, true])(
      "refuses approval after Demo conversion, including stale access=%s, but permits rejection",
      async (staleAccess) => {
        const organizationId = await seedOrg("public");
        const requestId = await seedPendingRequest(organizationId);
        const repository = testApp.module.get(OrganizationRepository);
        const ordinaryAccess = await repository.findAccess(organizationId, ownerId);
        await testApp.database
          .update(organizations)
          .set({ type: "demo" })
          .where(eq(organizations.id, organizationId));
        if (staleAccess) vi.spyOn(repository, "findAccess").mockResolvedValueOnce(ordinaryAccess);

        const refused = await testApp
          .patch(decidePath(organizationId, requestId))
          .withAuth(ownerId)
          .send({ decision: "approve" })
          .expect(StatusCodes.FORBIDDEN);
        expect(refused.body).toMatchObject({
          data: { code: "DEMO_JOIN_REQUEST_APPROVAL_DISABLED" },
        });
        expect(await membershipRows(organizationId, requesterId)).toEqual([]);
        const [pending] = await testApp.database
          .select()
          .from(organizationJoinRequests)
          .where(eq(organizationJoinRequests.id, requestId));
        expect(pending).toMatchObject({ status: "pending", decidedBy: null, decidedAt: null });
        expect(await rowsFor(requesterId)).toEqual([]);

        const rejected = await testApp
          .patch(decidePath(organizationId, requestId))
          .withAuth(ownerId)
          .send({ decision: "reject" })
          .expect(StatusCodes.OK);
        expect(rejected.body).toMatchObject({ status: "rejected" });
        expect(await membershipRows(organizationId, requesterId)).toEqual([]);
      },
    );

    it("the repository refuses a Demo approval independently of the use-case check", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);
      await testApp.database
        .update(organizations)
        .set({ type: "demo" })
        .where(eq(organizations.id, organizationId));
      const result = await testApp.module
        .get(OrganizationJoinRequestRepository)
        .approve(requestId, requesterId, organizationId, ownerId);
      expect(result.isSuccess()).toBe(true);
      if (result.isSuccess()) expect(result.value).toEqual({ outcome: "demo-organization" });
      expect(await membershipRows(organizationId, requesterId)).toEqual([]);
      const [request] = await testApp.database
        .select()
        .from(organizationJoinRequests)
        .where(eq(organizationJoinRequests.id, requestId));
      expect(request.status).toBe("pending");
    });

    it("approve admits the requester as a plain member and notifies them", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(adminId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("approved");
      expect(response.body.decidedBy).toBe(adminId);
      expect(await membershipRows(organizationId, requesterId)).toEqual([{ role: "member" }]);
      expect(await rowsFor(requesterId)).toMatchObject([
        {
          type: "organization_join_request_approved",
          actorId: adminId,
          resourceType: "organization",
          resourceId: organizationId,
          params: { organizationName: "Photosynthesis Lab" },
        },
      ]);
      // The decider acted, so nothing is told back to them.
      expect(await rowsFor(adminId)).toEqual([]);
      expect(await deliveriesFor(requesterId)).toMatchObject([
        { type: "organization_join_request_approved", channel: "email", status: "pending" },
      ]);
    });

    it.each(["approve", "reject"] as const)(
      "keeps a committed %s successful and hides email when the visibility read fails",
      async (decision) => {
        const organizationId = await seedOrg("public");
        const requestId = await seedPendingRequest(organizationId);
        vi.spyOn(
          testApp.module.get(EmailVisibilityService),
          "visibleUserEmails",
        ).mockRejectedValueOnce(new Error("Visibility read unavailable"));

        const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
          .patch(decidePath(organizationId, requestId))
          .withAuth(adminId)
          .send({ decision })
          .expect(StatusCodes.OK);

        const status = decision === "approve" ? "approved" : "rejected";
        expect(response.body).toMatchObject({ status, user: { id: requesterId, email: null } });
        expect(JSON.stringify(response.body)).not.toContain("requester@example.com");
        const persisted = await testApp.database
          .select({ status: organizationJoinRequests.status })
          .from(organizationJoinRequests)
          .where(eq(organizationJoinRequests.id, requestId));
        expect(persisted).toEqual([{ status }]);
        expect(await membershipRows(organizationId, requesterId)).toEqual(
          decision === "approve" ? [{ role: "member" }] : [],
        );
      },
    );

    it("approve is idempotent for somebody who joined meanwhile, keeping their role", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);
      await testApp.addOrganizationMember(organizationId, requesterId, "admin");

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("approved");
      expect(await membershipRows(organizationId, requesterId)).toEqual([{ role: "admin" }]);
      // They are told their request was approved for a membership they already had,
      // which is the behaviour the email had before dispatch.
      expect(await rowsFor(requesterId)).toMatchObject([
        { type: "organization_join_request_approved" },
      ]);
    });

    it("reject flips the status without admitting anybody", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "reject" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("rejected");
      expect(await membershipRows(organizationId, requesterId)).toEqual([]);
      expect(await rowsFor(requesterId)).toMatchObject([
        {
          type: "organization_join_request_rejected",
          actorId: ownerId,
          resourceType: "organization",
          resourceId: organizationId,
          params: { organizationName: "Photosynthesis Lab" },
        },
      ]);
      expect(await deliveriesFor(requesterId)).toMatchObject([
        { type: "organization_join_request_rejected", channel: "email", status: "pending" },
      ]);
    });

    it("notifies a requester who has no address, without an email", async () => {
      const organizationId = await seedOrg("public");
      // No profile row: the anonymized read gives no address, which is what the
      // dropped `if (!request.user.email) return` used to swallow the row for.
      const unonboarded = await testApp.createTestUser({
        email: "unonboarded@example.com",
        createProfile: false,
      });
      const requestId = await seedPendingRequest(organizationId, unonboarded);

      await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(await rowsFor(unonboarded)).toMatchObject([
        { type: "organization_join_request_approved" },
      ]);
      expect(await deliveriesFor(unonboarded)).toEqual([]);
    });

    it("409s a request that is no longer pending, telling nobody twice", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);

      await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "reject" })
        .expect(StatusCodes.OK);

      await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.CONFLICT);

      expect(await allRows()).toHaveLength(1);
    });

    it("403s a plain member", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);

      await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(plainMemberId)
        .send({ decision: "approve" })
        .expect(StatusCodes.FORBIDDEN);

      expect(await allRows()).toEqual([]);
    });

    it("404s a request belonging to another organization", async () => {
      const organizationId = await seedOrg("public");
      const otherOrg = await testApp.createOrganization("Other Lab", { visibility: "public" });
      await testApp.addOrganizationMember(otherOrg, ownerId, "owner");
      const foreignRequestId = await seedPendingRequest(otherOrg);

      await testApp
        .patch(decidePath(organizationId, foreignRequestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.NOT_FOUND);

      expect(await allRows()).toEqual([]);
    });

    it("still decides when the notification email cannot be queued", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);
      vi.spyOn(testApp.module.get(NotificationDeliveryRepository), "insertMany").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("approved");
      expect(await membershipRows(organizationId, requesterId)).toEqual([{ role: "member" }]);
      // The decision stands; the telling is all-or-nothing, so a delivery that could
      // not be written takes its notification row with it.
      expect(await rowsFor(requesterId)).toHaveLength(0);
      expect(await deliveriesFor(requesterId)).toEqual([]);
    });

    it("still decides when the notification cannot be dispatched", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);
      breakDispatch();

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("approved");
      expect(await membershipRows(organizationId, requesterId)).toEqual([{ role: "member" }]);
      expect(await allRows()).toEqual([]);
    });
  });

  describe("pending uniqueness", () => {
    it("keeps at most one pending request per person under concurrent submits", async () => {
      const organizationId = await seedOrg("public");

      const responses = await Promise.all([
        testApp.post(createPath(organizationId)).withAuth(requesterId).send({}),
        testApp.post(createPath(organizationId)).withAuth(requesterId).send({}),
      ]);

      // Either both dedup onto one row, or the partial unique index refuses the
      // loser with a conflict — never two pending rows, and never a 500.
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses[0]).toBe(StatusCodes.CREATED);
      expect([StatusCodes.CREATED, StatusCodes.CONFLICT]).toContain(statuses[1]);

      const listed: SuperTestResponse<OrganizationJoinRequestList> = await testApp
        .get(listPath(organizationId))
        .withAuth(ownerId)
        .expect(StatusCodes.OK);
      expect(listed.body.filter((request) => request.status === "pending")).toHaveLength(1);
    });
  });
});
