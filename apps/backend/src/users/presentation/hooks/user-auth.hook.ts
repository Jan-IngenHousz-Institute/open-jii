import { Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import z from "zod";

import { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { UserRepository } from "../../core/repositories/user.repository";

@Hook()
@Injectable()
export class UserAuthHook {
  private readonly logger = new Logger(UserAuthHook.name);

  constructor(
    private readonly acceptInvitationUseCase: AcceptPendingInvitationsUseCase,
    private readonly userRepository: UserRepository,
  ) {}

  @BeforeHook("/sign-in/email-otp")
  async handleEmailOtpSignInBefore(ctx: AuthHookContext) {
    const session = await this.getSessionFromCtx(ctx);
    if (!session?.user) return;

    const currentUser = session.user as { id: string; email?: string; registered?: boolean };

    const hasValidEmail = z.string().email().safeParse(currentUser.email).success;
    if (currentUser.registered && hasValidEmail) return;

    const body = ctx.body as { email?: string };
    const { email } = body;
    if (!email) return;

    const result = await this.userRepository.update(currentUser.id, { email });
    if (result.isFailure()) {
      if (result.error.code === "REPOSITORY_DUPLICATE") {
        throw new APIError("BAD_REQUEST", {
          message: "This email is already associated with another account",
        });
      }
      throw new APIError("INTERNAL_SERVER_ERROR", { message: result.error.message });
    }
  }

  @AfterHook("/sign-in/email")
  async handleEmailSignIn(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
  }

  @AfterHook("/sign-in/email-otp")
  async handleEmailOtpSignIn(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
  }

  @AfterHook("/sign-in/social")
  async handleSocialSignIn(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
  }

  @AfterHook("/email-otp/verify-email")
  async handleOtpVerify(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
  }

  /* v8 ignore next 3 */
  protected async getSessionFromCtx(ctx: AuthHookContext) {
    return getSessionFromCtx(ctx);
  }

  private async acceptInvitationsForNewUser(ctx: AuthHookContext) {
    try {
      const session = ctx.context.newSession;
      const user = session?.user;

      if (!user?.id || !user.email) return;

      // Only process for users who haven't completed registration yet
      if (user.registered) return;

      const result = await this.acceptInvitationUseCase.execute(user.id, user.email);

      if (result.isSuccess() && result.value > 0) {
        this.logger.log({
          msg: `Auto-accepted ${result.value} pending invitation(s) for new user`,
          operation: "invitation-auth-hook",
          userId: user.id,
          email: user.email,
          acceptedCount: result.value,
        });
      }
    } catch (error) {
      // Never let invitation processing block or fail the auth flow
      this.logger.warn({
        msg: "Failed to process pending invitations after auth",
        operation: "invitation-auth-hook",
        error,
      });
    }
  }
}
