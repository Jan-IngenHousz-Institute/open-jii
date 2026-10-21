import { Logger } from "@nestjs/common";

import { eq, notifications } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { queuedDeliveriesFor } from "../../../../test/notification-deliveries";
import { TestHarness } from "../../../../test/test-harness";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";
import { NotifyOrganizationMemberRemovedUseCase } from "./notify-organization-member-removed";

describe("NotifyOrganizationMemberRemovedUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: NotifyOrganizationMemberRemovedUseCase;
  let ownerId: string;
  let memberId: string;
  let organizationId: string;

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(NotifyOrganizationMemberRemovedUseCase);
    ownerId = await testApp.createTestUser({ name: "Olive Owner" });
    memberId = await testApp.createTestUser({ name: "Mona Member" });
    organizationId = await testApp.createOrganization("Photosynthesis Lab");
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("tells the member they were removed and queues their email", async () => {
    assertSuccess(await useCase.execute({ userId: memberId, organizationId }, ownerId));

    expect(await rowsFor(memberId)).toMatchObject([
      {
        type: "organization_membership_removed",
        recipientId: memberId,
        actorId: ownerId,
        resourceType: "organization",
        resourceId: organizationId,
        params: { organizationName: "Photosynthesis Lab" },
      },
    ]);
    expect(await deliveriesFor(memberId)).toMatchObject([
      { type: "organization_membership_removed", channel: "email", status: "pending" },
    ]);
  });

  it("stores the row but queues no email when the member switched the category off", async () => {
    assertSuccess(
      await testApp.module
        .get(NotificationRepository)
        .upsertPreference(memberId, "membership_and_access", "email", false),
    );

    assertSuccess(await useCase.execute({ userId: memberId, organizationId }, ownerId));

    expect(await rowsFor(memberId)).toHaveLength(1);
    expect(await deliveriesFor(memberId)).toEqual([]);
  });

  it("tells nobody when the member removed themselves", async () => {
    assertSuccess(await useCase.execute({ userId: ownerId, organizationId }, ownerId));

    expect(await rowsFor(ownerId)).toEqual([]);
    expect(await deliveriesFor(ownerId)).toEqual([]);
  });

  it("tells nobody when the organization is gone", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    assertSuccess(
      await useCase.execute({ userId: memberId, organizationId: crypto.randomUUID() }, ownerId),
    );

    expect(await rowsFor(memberId)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-member-removed" }),
    );
  });

  it("logs and writes nothing when the organization cannot be read", async () => {
    vi.spyOn(testApp.module.get(OrganizationRepository), "findName").mockResolvedValue(
      failure(AppError.internal("connection terminated")),
    );
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute({ userId: memberId, organizationId }, ownerId));

    expect(await rowsFor(memberId)).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-member-removed", organizationId }),
    );
  });

  it("logs and returns a failure when the notification cannot be stored", async () => {
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute({ userId: memberId, organizationId }, ownerId));

    expect(await rowsFor(memberId)).toEqual([]);
    expect(await deliveriesFor(memberId)).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notify-member-removed", organizationId }),
    );
  });
});
