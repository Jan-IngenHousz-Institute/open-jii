import { Logger } from "@nestjs/common";

import { eq, notifications } from "@repo/database";

import { EmailAdapter } from "../../../../common/modules/email/services/email.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { TestHarness } from "../../../../test/test-harness";
import type { PendingOrganizationInvitation } from "../../../core/models/user.model";
import type { UserRepository } from "../../../core/repositories/user.repository";
import { NotifyPendingOrganizationInvitationsUseCase } from "./notify-pending-organization-invitations";

const invitation = (
  overrides: Partial<PendingOrganizationInvitation> = {},
): PendingOrganizationInvitation => ({
  id: "inv-1",
  organizationId: "org-1",
  inviterId: "inviter-1",
  role: "member",
  organizationName: "Photosynthesis Lab",
  ...overrides,
});

/** The repository decides which invitations are waiting; this stubs its answer. */
function useCaseWith(pending: unknown) {
  const findPendingOrganizationInvitationsByEmail = vi.fn().mockResolvedValue(pending);
  const dispatch = vi.fn().mockResolvedValue(success({ created: 1, emailed: 0 }));

  const useCase = new NotifyPendingOrganizationInvitationsUseCase(
    { findPendingOrganizationInvitationsByEmail } as unknown as UserRepository,
    { dispatch } as unknown as NotificationDispatchService,
  );

  return { useCase, findPendingOrganizationInvitationsByEmail, dispatch };
}

describe("NotifyPendingOrganizationInvitationsUseCase", () => {
  it("writes one notification per pending invitation, and no email", async () => {
    const { useCase, findPendingOrganizationInvitationsByEmail, dispatch } = useCaseWith(
      success([
        invitation(),
        invitation({
          id: "inv-2",
          organizationId: "org-2",
          inviterId: "inviter-2",
          role: "admin",
          organizationName: "Canopy Lab",
        }),
      ]),
    );

    const result = await useCase.execute("user-123", "test@example.com");

    assertSuccess(result);
    expect(result.value).toBe(2);
    expect(findPendingOrganizationInvitationsByEmail).toHaveBeenCalledExactlyOnceWith(
      "test@example.com",
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "organization_invitation_received",
      recipientIds: ["user-123"],
      actorId: "inviter-1",
      resource: { type: "organization", id: "org-1" },
      params: { organizationName: "Photosynthesis Lab", role: "member" },
      // The invitation id, so somebody told at invite time is not told again.
      dedupeKey: "organization_invitation_received:inv-1",
      // Better Auth emailed them at invite time, when they had no account.
      suppressEmail: true,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "organization_invitation_received",
      recipientIds: ["user-123"],
      actorId: "inviter-2",
      resource: { type: "organization", id: "org-2" },
      params: { organizationName: "Canopy Lab", role: "admin" },
      dedupeKey: "organization_invitation_received:inv-2",
      suppressEmail: true,
    });
  });

  it("reads a role-less invitation as a member invitation", async () => {
    const { useCase, dispatch } = useCaseWith(success([invitation({ role: null })]));

    assertSuccess(await useCase.execute("user-123", "test@example.com"));

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        params: { organizationName: "Photosynthesis Lab", role: "member" },
      }),
    );
  });

  it("tells nobody anything when nothing is pending", async () => {
    const { useCase, dispatch } = useCaseWith(success([]));

    const result = await useCase.execute("user-123", "test@example.com");

    assertSuccess(result);
    expect(result.value).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("logs a failed dispatch and carries on with the rest", async () => {
    const { useCase, dispatch } = useCaseWith(success([invitation(), invitation({ id: "inv-2" })]));
    dispatch.mockResolvedValueOnce(failure(AppError.internal("notifications unavailable")));
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    const result = await useCase.execute("user-123", "test@example.com");

    assertSuccess(result);
    expect(result.value).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "organization-invitation-catch-up",
        invitationId: "inv-1",
      }),
    );
  });

  it("logs and gives up when the pending lookup fails", async () => {
    const { useCase, dispatch } = useCaseWith(failure(AppError.internal("connection terminated")));
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(await useCase.execute("user-123", "test@example.com"));

    expect(dispatch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "organization-invitation-catch-up" }),
    );
  });
});

/**
 * The dedupe and the suppressed email are properties of the rows dispatch writes, so
 * they are pinned against the real tables rather than against a stubbed dispatch.
 */
describe("catching up against the real tables", () => {
  const testApp = TestHarness.App;
  let useCase: NotifyPendingOrganizationInvitationsUseCase;
  let inviterId: string;
  let organizationId: string;
  let sendInvitation: ReturnType<typeof vi.spyOn>;

  const INVITEE_EMAIL = "Invitee@Example.com";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(NotifyPendingOrganizationInvitationsUseCase);
    inviterId = await testApp.createTestUser({ name: "Ivy Inviter" });
    organizationId = await testApp.createOrganization("Photosynthesis Lab");
    sendInvitation = vi
      .spyOn(testApp.module.get(EmailAdapter), "sendOrganizationInvitationNotification")
      .mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const seedInvitation = () =>
    testApp.addOrganizationInvitation({ organizationId, email: INVITEE_EMAIL, inviterId });

  it("writes the row dispatch stores for a pending invitation", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    const seeded = await seedInvitation();

    assertSuccess(await useCase.execute(inviteeId, INVITEE_EMAIL));

    expect(await rowsFor(inviteeId)).toMatchObject([
      {
        type: "organization_invitation_received",
        actorId: inviterId,
        resourceType: "organization",
        resourceId: organizationId,
        params: { organizationName: "Photosynthesis Lab", role: "member" },
        dedupeKey: `organization_invitation_received:${seeded.id}`,
      },
    ]);
  });

  it("sends no email, because the invitation email went out at invite time", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    await seedInvitation();

    await useCase.execute(inviteeId, INVITEE_EMAIL);

    // The invitee has an activated profile, so only `suppressEmail` keeps this quiet.
    expect(await rowsFor(inviteeId)).toHaveLength(1);
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  it("writes nothing new on a second sign-in", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    await seedInvitation();

    await useCase.execute(inviteeId, INVITEE_EMAIL);
    await useCase.execute(inviteeId, INVITEE_EMAIL);

    // The invitation id is the dedupe key here and at invite time, so an invitee who
    // already heard from either producer hears nothing again.
    expect(await rowsFor(inviteeId)).toHaveLength(1);
  });
});
