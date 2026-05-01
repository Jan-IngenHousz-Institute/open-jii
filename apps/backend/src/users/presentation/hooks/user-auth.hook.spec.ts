import type { AuthHookContext } from "@thallesp/nestjs-better-auth";

import { success, failure, AppError } from "../../../common/utils/fp-utils";
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

describe("UserAuthHook", () => {
  let hook: UserAuthHook;
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockUserRepository: { update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue(success(0)),
    };
    mockUserRepository = {
      update: vi.fn().mockResolvedValue(success([])),
    };

    hook = new UserAuthHook(
      mockUseCase as unknown as AcceptPendingInvitationsUseCase,
      mockUserRepository as unknown as UserRepository,
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

  describe("acceptInvitationsForNewUser (via handlers)", () => {
    it("should skip if user is already registered", async () => {
      const ctx = createMockContext({ registered: true });

      await hook.handleEmailSignIn(ctx);

      expect(mockUseCase.execute).not.toHaveBeenCalled();
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
});
