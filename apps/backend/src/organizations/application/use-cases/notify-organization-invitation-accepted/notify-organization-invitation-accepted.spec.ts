import { Logger } from "@nestjs/common";

import { eq, notifications } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { queuedDeliveriesFor } from "../../../../test/notification-deliveries";
import { TestHarness } from "../../../../test/test-harness";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";
import { NotifyOrganizationInvitationAcceptedUseCase } from "./notify-organization-invitation-accepted";

describe("NotifyOrganizationInvitationAcceptedUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: NotifyOrganizationInvitationAcceptedUseCase;
  let inviterId: string;
  let newMemberId: string;
  let organizationId: string;

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(NotifyOrganizationInvitationAcceptedUseCase);
    inviterId = await testApp.createTestUser({ name: "Ivy Inviter" });
    newMemberId = await testApp.createTestUser({ name: "Nina Newcomer" });
    organizationId = await testApp.createOrganization("Photosynthesis Lab");
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("tells the inviter, from the new member, and queues no email", async () => {
    assertSuccess(await useCase.execute({ inviterId, organizationId }, newMemberId));

    expect(await rowsFor(inviterId)).toMatchObject([
      {
        type: "organization_invitation_accepted",
        recipientId: inviterId,
        actorId: newMemberId,
        resourceType: "organization",
        resourceId: organizationId,
        params: { organizationName: "Photosynthesis Lab" },
      },
    ]);
    expect(await deliveriesFor(inviterId)).toEqual([]);
    expect(await rowsFor(newMemberId)).toEqual([]);
  });

  it("tells nobody when the organization is gone", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    assertSuccess(
      await useCase.execute({ inviterId, organizationId: crypto.randomUUID() }, newMemberId),
    );

    expect(await rowsFor(inviterId)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitation-accepted" }),
    );
  });

  it("logs and writes nothing when the organization cannot be read", async () => {
    vi.spyOn(testApp.module.get(OrganizationRepository), "findName").mockResolvedValue(
      failure(AppError.internal("connection terminated")),
    );
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute({ inviterId, organizationId }, newMemberId));

    expect(await rowsFor(inviterId)).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitation-accepted", organizationId }),
    );
  });

  it("logs and returns a failure when the notification cannot be stored", async () => {
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute({ inviterId, organizationId }, newMemberId));

    expect(await rowsFor(inviterId)).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-invitation-accepted", organizationId }),
    );
  });
});
