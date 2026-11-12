import { Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import z from "zod";

import { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { NotifyPendingOrganizationInvitationsUseCase } from "../../application/use-cases/notify-pending-organization-invitations/notify-pending-organization-invitations";
import { UserRepository } from "../../core/repositories/user.repository";

@Hook()
@Injectable()
export class UserAuthHook {
  private readonly logger = new Logger(UserAuthHook.name);

  constructor(
    private readonly acceptInvitationUseCase: AcceptPendingInvitationsUseCase,
    private readonly userRepository: UserRepository,
    private readonly notifyPendingInvitationsUseCase: NotifyPendingOrganizationInvitationsUseCase,
  ) {}

  @BeforeHook("/sign-in/email-otp")
  async handleEmailOtpSignInBefore(ctx: AuthHookContext) {
    const session = await this.getSessionFromCtx(ctx);
    if (!session?.user) return;

    const currentUser = session.user as { id: string; email?: string; registered?: boolean };

    const hasValidEmail = z.string().email().safeParse(currentUser.email).success;
    if (currentUser.registered && hasValidEmail) return;

    // The body is not validated until after this hook. Anything that is not an address is left
    // to that validation: an ORCID iD written here would match an ORCID placeholder at sign-in.
    // The endpoint looks the address up lowercased, so it is stored that way.
    const body = ctx.body as { email?: unknown };
    const parsed = z.string().email().safeParse(body.email);
    if (!parsed.success) return;
    const email = parsed.data.toLowerCase();
    if (email === currentUser.email?.toLowerCase()) return;

    // The verified flag must never carry over to an address nobody has proven; the code that
    // follows proves it.
    const result = await this.userRepository.update(currentUser.id, {
      email,
      emailVerified: false,
    });
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
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/sign-in/email-otp")
  async handleEmailOtpSignIn(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/sign-in/social")
  async handleSocialSignIn(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  /**
   * `/sign-in/social` only hands out the provider's redirect URL — the session is
   * created when the provider redirects back, so this callback path is the only
   * place an OAuth sign-up can be caught. Better Auth matches hooks on the route
   * pattern by exact equality, so the parameter name has to be its own.
   */
  @AfterHook("/callback/:id")
  async handleOAuthCallback(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/email-otp/verify-email")
  async handleOtpVerify(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
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

      // Deliberately no `registered` short-circuit: a first sign-in is the only
      // attempt such a check would ever allow, so any transient failure would be
      // lost for good. The pending lookups are indexed on `(email, status)`, so
      // signing in with nothing waiting costs two index probes and an acceptance
      // that failed once heals on the next sign-in.
      const result = await this.acceptInvitationUseCase.execute(user.id, user.email);

      if (result.isSuccess() && result.value > 0) {
        this.logger.log({
          msg: `Auto-accepted ${result.value} pending invitation(s)`,
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

  /**
   * Guarded like the acceptance above it: a fault while catching up on organization
   * invitations must not fail a sign-in that has already succeeded.
   */
  private async notifyPendingOrganizationInvitations(ctx: AuthHookContext) {
    try {
      const user = ctx.context.newSession?.user;
      if (!user?.id || !user.email) return;

      await this.notifyPendingInvitationsUseCase.execute(user.id, user.email);
    } catch (error) {
      this.logger.warn({
        msg: "Failed to catch up on pending organization invitations, the sign-in stands",
        operation: "organization-invitation-catch-up",
        error,
      });
    }
  }
}
