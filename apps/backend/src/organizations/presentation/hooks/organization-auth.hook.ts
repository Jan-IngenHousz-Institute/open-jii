import { Inject, Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { eq, isPersonalOrgSlug, organizations } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AcceptPendingOrganizationInvitationsUseCase } from "../../application/use-cases/accept-pending-organization-invitations/accept-pending-organization-invitations";

/**
 * Better Auth's organization hooks cover create/update/delete, members,
 * invitations and teams — but `/organization/leave` fires none of them, so the
 * personal-workspace shield for that one path has to be hand-rolled here. The
 * path is matched by exact equality (the adapter has no wildcards), so this
 * decorator names the endpoint verbatim.
 *
 * The same exact-path mechanism carries the sign-in auto-accept for organization
 * invitations: Better Auth alone only accepts an invitation when the invitee
 * follows the link, but signing up with an invited address has to admit them too.
 */
@Hook()
@Injectable()
export class OrganizationAuthHook {
  private readonly logger = new Logger(OrganizationAuthHook.name);

  constructor(
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    private readonly acceptInvitationsUseCase: AcceptPendingOrganizationInvitationsUseCase,
  ) {}

  @BeforeHook("/organization/leave")
  async refuseLeavingPersonalWorkspace(ctx: AuthHookContext) {
    const { organizationId } = (ctx.body ?? {}) as { organizationId?: string };
    if (!organizationId) return;

    const rows = await this.database
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (isPersonalOrgSlug(rows[0]?.slug)) {
      throw new APIError("BAD_REQUEST", {
        message: "You cannot leave your personal workspace.",
      });
    }
  }

  @AfterHook("/sign-in/email")
  async handleEmailSignIn(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  @AfterHook("/sign-in/email-otp")
  async handleEmailOtpSignIn(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  @AfterHook("/sign-in/social")
  async handleSocialSignIn(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  /**
   * `/sign-in/social` only hands out the provider's redirect URL — the session is
   * created when the provider redirects back, so these two callback paths are the
   * only place an OAuth sign-up can be caught. The parameter names are Better
   * Auth's own, because the adapter compares the whole route string.
   */
  @AfterHook("/callback/:id")
  async handleOAuthCallback(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  @AfterHook("/oauth2/callback/:providerId")
  async handleGenericOAuthCallback(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  @AfterHook("/email-otp/verify-email")
  async handleOtpVerify(ctx: AuthHookContext) {
    await this.acceptInvitations(ctx);
  }

  private async acceptInvitations(ctx: AuthHookContext) {
    try {
      const user = ctx.context.newSession?.user;
      if (!user?.id || !user.email) return;

      const result = await this.acceptInvitationsUseCase.execute(user.id, user.email);

      if (result.isSuccess() && result.value > 0) {
        this.logger.log({
          msg: `Auto-accepted ${result.value} pending organization invitation(s)`,
          operation: "organization-invitation-auth-hook",
          userId: user.id,
          email: user.email,
          acceptedCount: result.value,
        });
      }
    } catch (error) {
      // Never let invitation processing block or fail the auth flow.
      this.logger.warn({
        msg: "Failed to process pending organization invitations after auth",
        operation: "organization-invitation-auth-hook",
        error,
      });
    }
  }
}
