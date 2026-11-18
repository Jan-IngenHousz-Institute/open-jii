import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import type { MockInstance } from "vitest";

import { success, failure, AppError } from "../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentAnnotationsRepository } from "../../../experiments/core/repositories/experiment-annotations.repository";
import { ExperimentDataOutboxRepository } from "../../../experiments/core/repositories/experiment-data-outbox.repository";
import type { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import type { NotifyPendingOrganizationInvitationsUseCase } from "../../application/use-cases/notify-pending-organization-invitations/notify-pending-organization-invitations";
import { ReactivateProfileUseCase } from "../../application/use-cases/reactivate-profile/reactivate-profile";
import { UserRepository } from "../../core/repositories/user.repository";
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

describe("UserAuthHook", () => {
  let hook: UserAuthHook;
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUserRepository: { update: ReturnType<typeof vi.fn> };
  let mockNotifyUseCase: { execute: ReturnType<typeof vi.fn> };
  let reactivateProfile: MockInstance<ReactivateProfileUseCase["execute"]>;

  beforeEach(async () => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue(success(0)),
    };
    mockUserRepository = {
      update: vi.fn().mockResolvedValue(success([])),
    };
    mockNotifyUseCase = {
      execute: vi.fn().mockResolvedValue(success(0)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactivateProfileUseCase,
        { provide: UserRepository, useValue: {} },
        { provide: ExperimentAnnotationsRepository, useValue: {} },
        { provide: ExperimentDataOutboxRepository, useValue: {} },
        { provide: ExperimentDataOutboxWorker, useValue: {} },
      ],
    }).compile();
    const reactivateProfileUseCase = module.get(ReactivateProfileUseCase);
    reactivateProfile = vi
      .spyOn(reactivateProfileUseCase, "execute")
      .mockResolvedValue(success(false));

    hook = new UserAuthHook(
      mockUseCase as unknown as AcceptPendingInvitationsUseCase,
      mockUserRepository as unknown as UserRepository,
      mockNotifyUseCase as unknown as NotifyPendingOrganizationInvitationsUseCase,
      reactivateProfileUseCase,
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

  describe("reactivateProfile (via handlers)", () => {
    const signIns: (
      | "handleEmailSignIn"
      | "handleEmailOtpSignIn"
      | "handleSocialSignIn"
      | "handleOAuthCallback"
      | "handlePasskeySignIn"
    )[] = [
      "handleEmailSignIn",
      "handleEmailOtpSignIn",
      "handleSocialSignIn",
      "handleOAuthCallback",
      "handlePasskeySignIn",
    ];

    it.each(signIns)("reactivates the signed-in profile on %s", async (handler) => {
      await hook[handler](createMockContext());

      expect(reactivateProfile).toHaveBeenCalledExactlyOnceWith("user-123");
    });

    it("only reactivates on a passkey sign-in, which never processed invitations", async () => {
      await hook.handlePasskeySignIn(createMockContext());

      expect(mockUseCase.execute).not.toHaveBeenCalled();
      expect(mockNotifyUseCase.execute).not.toHaveBeenCalled();
    });

    it("leaves the profile alone when an email is only verified", async () => {
      await hook.handleOtpVerify(createMockContext());

      expect(reactivateProfile).not.toHaveBeenCalled();
    });

    it("reactivates nothing without a signed-in user", async () => {
      await hook.handleEmailSignIn(createMockContext({ userId: null }));

      expect(reactivateProfile).not.toHaveBeenCalled();
    });

    it("logs a failed reactivation and signs the user in anyway", async () => {
      reactivateProfile.mockResolvedValue(failure(AppError.internal("outbox unavailable")));
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      await expect(hook.handleEmailSignIn(createMockContext())).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "profile-reactivation", userId: "user-123" }),
      );
      expect(mockUseCase.execute).toHaveBeenCalled();
    });
  });

  describe("notifyPendingOrganizationInvitations (via handlers)", () => {
    it.each([
      ["handleEmailSignIn"],
      ["handleEmailOtpSignIn"],
      ["handleSocialSignIn"],
      ["handleOAuthCallback"],
      ["handleOtpVerify"],
    ] as const)("runs on %s, the same paths the acceptance runs on", async (handler) => {
      await hook[handler](createMockContext());

      expect(mockNotifyUseCase.execute).toHaveBeenCalledExactlyOnceWith(
        "user-123",
        "test@example.com",
      );
    });

    it("does not look for invitations without a signed-in user", async () => {
      await hook.handleEmailSignIn(createMockContext({ userId: null }));
      await hook.handleEmailSignIn(createMockContext({ email: null }));

      expect(mockNotifyUseCase.execute).not.toHaveBeenCalled();
    });

    it("signs the user in anyway when the use case reports a failure", async () => {
      mockNotifyUseCase.execute.mockResolvedValue(
        failure(AppError.internal("notifications unavailable")),
      );

      await expect(hook.handleEmailSignIn(createMockContext())).resolves.toBeUndefined();
    });

    it("swallows a thrown fault rather than failing a sign-in that succeeded", async () => {
      mockNotifyUseCase.execute.mockRejectedValue(new Error("connection terminated"));
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

      await expect(hook.handleEmailSignIn(createMockContext())).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "organization-invitation-catch-up" }),
      );
    });
  });
});
