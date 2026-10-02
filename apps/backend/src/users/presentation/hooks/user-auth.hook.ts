import { Inject, Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import z from "zod";

import { and, eq, gt, organizationInvitations, organizations, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { AcceptPendingInvitationsUseCase } from "../../application/use-cases/accept-pending-invitations/accept-pending-invitations";
import { UserRepository } from "../../core/repositories/user.repository";

@Hook()
@Injectable()
export class UserAuthHook {
  private readonly logger = new Logger(UserAuthHook.name);

  constructor(
    private readonly acceptInvitationUseCase: AcceptPendingInvitationsUseCase,
    private readonly userRepository: UserRepository,
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    private readonly notifications: NotificationDispatchService,
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
   * created when the provider redirects back, so these two callback paths are the
   * only place an OAuth sign-up can be caught. Better Auth matches hooks on the
   * route pattern by exact equality, so the parameter names have to be its own.
   */
  @AfterHook("/callback/:id")
  async handleOAuthCallback(ctx: AuthHookContext) {
    await this.acceptInvitationsForNewUser(ctx);
    await this.notifyPendingOrganizationInvitations(ctx);
  }

  @AfterHook("/oauth2/callback/:providerId")
  async handleGenericOAuthCallback(ctx: AuthHookContext) {
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
   * Somebody invited to an organization before they had an account got no notification
   * at invite time — there was no account to address one to, and `packages/auth` emailed
   * them instead. This writes the row on their first sign-in, so their bell is not dark
   * for an invitation that is waiting for them.
   *
   * Keyed on the invitation id, the same key the invite-time hook uses, so an invitee
   * who already heard hears nothing again however often they sign in. `suppressEmail`
   * because the invitation email went out at invite time, by the other half of the
   * split.
   *
   * Guarded like the acceptance above it: a fault in here must not fail a sign-in that
   * has already succeeded.
   */
  private async notifyPendingOrganizationInvitations(ctx: AuthHookContext) {
    try {
      const user = ctx.context.newSession?.user;
      if (!user?.id || !user.email) return;

      const pending = await this.database
        .select({
          id: organizationInvitations.id,
          organizationId: organizationInvitations.organizationId,
          inviterId: organizationInvitations.inviterId,
          role: organizationInvitations.role,
          organizationName: organizations.name,
        })
        .from(organizationInvitations)
        .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
        .where(
          and(
            // Lowercased on both sides, as everywhere else: Better Auth stores the
            // address as the inviter typed it, and an account created through an OAuth
            // provider may carry mixed case.
            sql`lower(${organizationInvitations.email}) = lower(${user.email})`,
            eq(organizationInvitations.status, "pending"),
            // A lapsed invitation is already dead to every other reader, so there is
            // nothing to tell anybody about.
            gt(organizationInvitations.expiresAt, new Date()),
          ),
        );

      for (const invitation of pending) {
        const dispatched = await this.notifications.dispatch({
          type: "organization_invitation_received",
          recipientIds: [user.id],
          actorId: invitation.inviterId,
          resource: { type: "organization", id: invitation.organizationId },
          params: {
            organizationName: invitation.organizationName,
            // A role-less invitation is a member invitation everywhere else.
            role: invitation.role ?? "member",
          },
          dedupeKey: `organization_invitation_received:${invitation.id}`,
          suppressEmail: true,
        });

        if (dispatched.isFailure()) {
          this.logger.error({
            msg: "Failed to notify a signing-in user of a pending organization invitation",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "organization-invitation-catch-up",
            invitationId: invitation.id,
            error: dispatched.error,
          });
        }
      }
    } catch (error) {
      this.logger.warn({
        msg: "Failed to catch up on pending organization invitations, the sign-in stands",
        operation: "organization-invitation-catch-up",
        error,
      });
    }
  }
}
