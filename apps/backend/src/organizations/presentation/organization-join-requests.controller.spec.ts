/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  OrganizationJoinRequest,
  OrganizationJoinRequestList,
} from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import {
  and,
  eq,
  notifications,
  organizationJoinRequests,
  organizationMembers,
  organizations,
} from "@repo/database";

import { EmailAdapter } from "../../common/modules/email/services/email.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../notifications/application/services/notification-dispatch.service";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
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

      const recipients = vi
        .mocked(emailAdapter.sendOrganizationJoinRequestSubmittedNotification)
        .mock.calls.map((call) => call[3])
        .sort();
      expect(recipients).toEqual(["admin@example.com", "owner@example.com"]);
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
      expect(
        vi.mocked(emailAdapter.sendOrganizationJoinRequestSubmittedNotification).mock.calls,
      ).toHaveLength(2);
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
      expect(emailAdapter.sendOrganizationJoinRequestApprovedNotification).toHaveBeenCalledWith(
        organizationId,
        "Photosynthesis Lab",
        "requester@example.com",
      );
    });

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
      expect(emailAdapter.sendOrganizationJoinRequestRejectedNotification).toHaveBeenCalled();
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
      expect(emailAdapter.sendOrganizationJoinRequestApprovedNotification).not.toHaveBeenCalled();
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

    it("still decides when the notification email fails", async () => {
      const organizationId = await seedOrg("public");
      const requestId = await seedPendingRequest(organizationId);
      vi.mocked(emailAdapter.sendOrganizationJoinRequestApprovedNotification).mockResolvedValue(
        failure(AppError.internal("smtp down")),
      );

      const response: SuperTestResponse<OrganizationJoinRequest> = await testApp
        .patch(decidePath(organizationId, requestId))
        .withAuth(ownerId)
        .send({ decision: "approve" })
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("approved");
      expect(await membershipRows(organizationId, requesterId)).toEqual([{ role: "member" }]);
      // The row is in before the email leaves, so a refused mail server loses nothing.
      expect(await rowsFor(requesterId)).toHaveLength(1);
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
