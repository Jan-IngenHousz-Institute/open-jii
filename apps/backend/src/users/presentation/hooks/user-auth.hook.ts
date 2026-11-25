import { Injectable, Logger } from "@nestjs/common";
import { AfterHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";

import { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { NotifyPendingOrganizationInvitationsUseCase } from "../../application/use-cases/notify-pending-organization-invitations/notify-pending-organization-invitations";
import { ReactivateProfileUseCase } from "../../application/use-cases/reactivate-profile/reactivate-profile";

@Hook()
@Injectable()
export class UserAuthHook {
  private readonly logger = new Logger(UserAuthHook.name);

  constructor(
    private readonly acceptInvitationUseCase: AcceptPendingInvitationsUseCase,
    private readonly notifyPendingInvitationsUseCase: NotifyPendingOrganizationInvitationsUseCase,
    private readonly reactivateProfileUseCase: ReactivateProfileUseCase,
  ) {}

  @AfterHook("/sign-in/email")
  async handleEmailSignIn(ctx: AuthHookContext) {
    await this.reactivateProfile(ctx);
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/sign-in/email-otp")
  async handleEmailOtpSignIn(ctx: AuthHookContext) {
    await this.reactivateProfile(ctx);
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/sign-in/social")
  async handleSocialSignIn(ctx: AuthHookContext) {
    await this.reactivateProfile(ctx);
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
    await this.reactivateProfile(ctx);
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  /**
   * Registration gives an account with no address, an ORCID sign-up whose email is private,
   * its address here rather than through a sign-in. The route re-issues the session with the
   * new address, so the invitations waiting for it are found the same way.
   */
  @AfterHook("/email-otp/change-email")
  async handleEmailChange(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/passkey/verify-authentication")
  async handlePasskeySignIn(ctx: AuthHookContext) {
    await this.reactivateProfile(ctx);
  }

  @AfterHook("/email-otp/verify-email")
  async handleOtpVerify(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  /** A failure must not fail a sign-in that has already succeeded. */
  private async reactivateProfile(ctx: AuthHookContext) {
    const user = ctx.context.newSession?.user;
    if (!user?.id) {
      return;
    }

    const result = await this.reactivateProfileUseCase.execute(user.id);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Failed to reactivate the profile on sign-in, the sign-in stands",
        operation: "profile-reactivation",
        userId: user.id,
        error: result.error.message,
      });
    }
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
