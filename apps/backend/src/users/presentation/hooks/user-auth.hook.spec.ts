import { Logger } from "@nestjs/common";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import type { MockInstance } from "vitest";

import { eq, notifications } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { TestHarness } from "../../../test/test-harness";
import type { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import type { UserRepository } from "../../core/repositories/user.repository";
import { UserAuthHook } from "./user-auth.hook";

function createMockContext(
  overrides: {
    userId?: string | null;
    email?: string | null;
    registered?: boolean;
  } = {},
): AuthHookContext {
  return {
    context: {
      newSession: {
        user: {
          id: "userId" in overrides ? overrides.userId : "user-123",
          email: "email" in overrides ? overrides.email : "test@example.com",
          registered: overrides.registered ?? false,
        },
      },
    },
  } as unknown as AuthHookContext;
}

/** A row of the catch-up's one select: pending invitations joined to their organization. */
interface PendingRow {
  id: string;
  organizationId: string;
  inviterId: string;
  role: string | null;
  organizationName: string;
}

describe("UserAuthHook", () => {
  let hook: UserAuthHook;
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUserRepository: { update: ReturnType<typeof vi.fn> };
  let mockDispatch: ReturnType<typeof vi.fn>;
  /** What the stubbed select answers with; `status` and `expires_at` are filtered in SQL. */
  let pendingInvitations: PendingRow[];

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue(success(0)),
    };
    mockUserRepository = {
      update: vi.fn().mockResolvedValue(success([])),
    };
    mockDispatch = vi.fn().mockResolvedValue(success({ created: 1, emailed: 0 }));
    pendingInvitations = [];

    const database = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve(pendingInvitations),
          }),
        }),
      }),
    } as unknown as DatabaseInstance;

    hook = new UserAuthHook(
      mockUseCase as unknown as AcceptPendingInvitationsUseCase,
      mockUserRepository as unknown as UserRepository,
      database,
      { dispatch: mockDispatch } as unknown as NotificationDispatchService,
    );
  });

  describe("handleEmailOtpSignInBefore", () => {
    function createBeforeHookContext(email?: string): AuthHookContext {
      return { body: email !== undefined ? { email } : {} } as unknown as AuthHookContext;
    }

    beforeEach(() => {
      vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue({
        user: { id: "user-123", email: null, registered: false },
      });
    });

    it("should return early if no session", async () => {
      vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue(null);
      const ctx = createBeforeHookContext("new@example.com");

      await hook.handleEmailOtpSignInBefore(ctx);

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it("should return early if user is registered and has a valid email", async () => {
      vi.spyOn(hook as any, "getSessionFromCtx").mockResolvedValue({
        user: { id: "user-123", email: "existing@example.com", registered: true },
      } as any);
      const ctx = createBeforeHookContext("new@example.com");

      await hook.handleEmailOtpSignInBefore(ctx);

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it("should return early if no email in body", async () => {
      const ctx = createBeforeHookContext();

      await hook.handleEmailOtpSignInBefore(ctx);

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it("should update user email when user lacks a valid email", async () => {
      const ctx = createBeforeHookContext("new@example.com");

      await hook.handleEmailOtpSignInBefore(ctx);

      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        email: "new@example.com",
      });
    });

    it("should throw BAD_REQUEST when email is already taken", async () => {
      mockUserRepository.update.mockResolvedValue(
        failure(AppError.badRequest("Duplicate", "REPOSITORY_DUPLICATE")),
      );
      const ctx = createBeforeHookContext("taken@example.com");

      await expect(hook.handleEmailOtpSignInBefore(ctx)).rejects.toThrow(
        "This email is already associated with another account",
      );
    });

    it("should throw for other repository errors", async () => {
      mockUserRepository.update.mockResolvedValue(
        failure(AppError.internal("DB connection failed")),
      );
      const ctx = createBeforeHookContext("new@example.com");

      await expect(hook.handleEmailOtpSignInBefore(ctx)).rejects.toThrow();
    });
  });

  describe("handleEmailSignIn", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("handleEmailOtpSignIn", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleEmailOtpSignIn(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("handleSocialSignIn", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleSocialSignIn(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("handleOtpVerify", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleOtpVerify(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("handleOAuthCallback", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleOAuthCallback(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("handleGenericOAuthCallback", () => {
    it("should call acceptInvitationsForNewUser", async () => {
      const ctx = createMockContext();

      await hook.handleGenericOAuthCallback(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });
  });

  describe("acceptInvitationsForNewUser (via handlers)", () => {
    it("processes an already-registered user, so a failed acceptance heals later", async () => {
      const ctx = createMockContext({ registered: true });

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("user-123", "test@example.com");
    });

    it("should skip if user id is missing", async () => {
      const ctx = createMockContext({ userId: null });

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it("should skip if user email is missing", async () => {
      const ctx = createMockContext({ email: null });

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it("should skip if newSession is undefined", async () => {
      const ctx = { context: {} } as unknown as AuthHookContext;

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it("should skip if user is undefined", async () => {
      const ctx = { context: { newSession: {} } } as unknown as AuthHookContext;

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
    });

    it("should not throw when use case returns failure", async () => {
      mockUseCase.execute.mockResolvedValue(failure(AppError.internal("DB error")));
      const ctx = createMockContext();

      // Should not throw — the hook processes the result but doesn't re-throw
      await expect(hook.handleEmailSignIn(ctx)).resolves.not.toThrow();
      expect(mockUseCase.execute).toHaveBeenCalled();
    });

    it("should not throw when use case throws an error", async () => {
      mockUseCase.execute.mockRejectedValue(new Error("Unexpected error"));
      const ctx = createMockContext();

      // The hook catches all errors to never block auth flow
      await expect(hook.handleEmailSignIn(ctx)).resolves.not.toThrow();
    });

    it("should call use case when invitations are accepted", async () => {
      mockUseCase.execute.mockResolvedValue(success(3));
      const ctx = createMockContext({ userId: "new-user", email: "invited@example.com" });

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).toHaveBeenCalledWith("new-user", "invited@example.com");
    });
  });

  describe("notifyPendingOrganizationInvitations (via handlers)", () => {
    const invitation = (overrides: Partial<PendingRow> = {}): PendingRow => ({
      id: "inv-1",
      organizationId: "org-1",
      inviterId: "inviter-1",
      role: "member",
      organizationName: "Photosynthesis Lab",
      ...overrides,
    });

    it("writes one notification per pending invitation, and no email", async () => {
      pendingInvitations = [
        invitation(),
        invitation({
          id: "inv-2",
          organizationId: "org-2",
          inviterId: "inviter-2",
          role: "admin",
          organizationName: "Canopy Lab",
        }),
      ];

      await hook.handleEmailOtpSignIn(createMockContext());

      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatch).toHaveBeenNthCalledWith(1, {
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
      expect(mockDispatch).toHaveBeenNthCalledWith(2, {
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
      pendingInvitations = [invitation({ role: null })];

      await hook.handleEmailSignIn(createMockContext());

      expect(mockDispatch).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          params: { organizationName: "Photosynthesis Lab", role: "member" },
        }),
      );
    });

    it("tells nobody anything when nothing is pending", async () => {
      await hook.handleEmailSignIn(createMockContext());

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("does not look for invitations without a signed-in user", async () => {
      pendingInvitations = [invitation()];

      await hook.handleEmailSignIn(createMockContext({ userId: null }));
      await hook.handleEmailSignIn(createMockContext({ email: null }));

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it.each([
      ["handleEmailSignIn"],
      ["handleEmailOtpSignIn"],
      ["handleSocialSignIn"],
      ["handleOAuthCallback"],
      ["handleGenericOAuthCallback"],
      ["handleOtpVerify"],
    ] as const)("runs on %s, the same paths the acceptance runs on", async (handler) => {
      pendingInvitations = [invitation()];

      await hook[handler](createMockContext());

      expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    it("logs and signs the user in anyway when the dispatch fails", async () => {
      pendingInvitations = [invitation()];
      mockDispatch.mockResolvedValue(failure(AppError.internal("notifications unavailable")));
      const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

      await expect(hook.handleEmailSignIn(createMockContext())).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "organization-invitation-catch-up",
          invitationId: "inv-1",
        }),
      );
    });

    it("swallows a thrown fault rather than failing a sign-in that succeeded", async () => {
      pendingInvitations = [invitation()];
      mockDispatch.mockRejectedValue(new Error("connection terminated"));
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      await expect(hook.handleEmailSignIn(createMockContext())).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "organization-invitation-catch-up" }),
      );
    });
  });
});

/**
 * The catch-up's one select does the deciding — pending, unexpired, this address —
 * and a stubbed query builder can only answer what it is handed, so the filtering
 * is pinned here against the real tables, together with the dedupe that keeps a
 * person who already heard from hearing twice.
 */
describe("catching up on organization invitations against the real tables", () => {
  const testApp = TestHarness.App;
  let hook: UserAuthHook;
  let inviterId: string;
  let organizationId: string;
  let sendInvitation: MockInstance<EmailAdapter["sendOrganizationInvitationNotification"]>;

  const INVITEE_EMAIL = "Invitee@Example.com";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    hook = testApp.module.get(UserAuthHook);
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

  /** The address is stored lowercased by Better Auth; the account carries mixed case. */
  const signingIn = (userId: string) =>
    ({
      context: { newSession: { user: { id: userId, email: INVITEE_EMAIL } } },
    }) as unknown as AuthHookContext;

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const seedInvitation = (options: { expiresAt?: Date; status?: string } = {}) =>
    testApp.addOrganizationInvitation({
      organizationId,
      email: INVITEE_EMAIL,
      inviterId,
      ...options,
    });

  it("writes a row per pending invitation and nothing for a lapsed one", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    const first = await seedInvitation();
    const second = await testApp.addOrganizationInvitation({
      organizationId: await testApp.createOrganization("Canopy Lab"),
      email: INVITEE_EMAIL,
      inviterId,
      role: "admin",
    });
    await seedInvitation({ expiresAt: new Date(Date.now() - 1000) });

    await hook.handleEmailOtpSignIn(signingIn(inviteeId));

    const rows = await rowsFor(inviteeId);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.dedupeKey).sort()).toEqual(
      [
        `organization_invitation_received:${first.id}`,
        `organization_invitation_received:${second.id}`,
      ].sort(),
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "organization_invitation_received",
          actorId: inviterId,
          resourceType: "organization",
          resourceId: organizationId,
          params: { organizationName: "Photosynthesis Lab", role: "member" },
        }),
      ]),
    );
  });

  it("sends no email, because the invitation email went out at invite time", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    await seedInvitation();

    await hook.handleEmailOtpSignIn(signingIn(inviteeId));

    // The invitee has an activated profile, so only `suppressEmail` keeps this quiet.
    expect(await rowsFor(inviteeId)).toHaveLength(1);
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  it("writes nothing new on a second sign-in", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    await seedInvitation();

    await hook.handleEmailOtpSignIn(signingIn(inviteeId));
    await hook.handleEmailOtpSignIn(signingIn(inviteeId));

    // The invitation id is the dedupe key here and at invite time, so an invitee who
    // already heard from either producer hears nothing again.
    expect(await rowsFor(inviteeId)).toHaveLength(1);
  });

  it("leaves a cancelled invitation alone", async () => {
    const inviteeId = await testApp.createTestUser({ email: INVITEE_EMAIL });
    await seedInvitation({ status: "canceled" });

    await hook.handleEmailOtpSignIn(signingIn(inviteeId));

    expect(await rowsFor(inviteeId)).toEqual([]);
  });

  it("tells somebody else's invitee nothing", async () => {
    const strangerId = await testApp.createTestUser({ email: "stranger@example.com" });
    await seedInvitation();

    await hook.handleEmailOtpSignIn({
      context: { newSession: { user: { id: strangerId, email: "stranger@example.com" } } },
    } as unknown as AuthHookContext);

    expect(await rowsFor(strangerId)).toEqual([]);
  });
});
