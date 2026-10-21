import { Inject, Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";

import { eq, isPersonalOrgSlug, organizations } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { NotifyOrganizationInvitationAcceptedUseCase } from "../../application/use-cases/notify-organization-invitation-accepted/notify-organization-invitation-accepted";
import type { AcceptedOrganizationInvitation } from "../../application/use-cases/notify-organization-invitation-accepted/notify-organization-invitation-accepted";
import { NotifyOrganizationInviteeUseCase } from "../../application/use-cases/notify-organization-invitee/notify-organization-invitee";
import type { CreatedOrganizationInvitation } from "../../application/use-cases/notify-organization-invitee/notify-organization-invitee";
import { NotifyOrganizationMemberRemovedUseCase } from "../../application/use-cases/notify-organization-member-removed/notify-organization-member-removed";
import type { RemovedOrganizationMember } from "../../application/use-cases/notify-organization-member-removed/notify-organization-member-removed";
import { NotifyOrganizationRoleChangedUseCase } from "../../application/use-cases/notify-organization-role-changed/notify-organization-role-changed";
import type { UpdatedOrganizationMember } from "../../application/use-cases/notify-organization-role-changed/notify-organization-role-changed";

/**
 * What `/organization/invite-member` returns when it really created an invitation.
 * Anything else — a refusal, a shape a future Better Auth returns instead — is left
 * alone rather than guessed at.
 */
function isPendingInvitation(returned: unknown): returned is CreatedOrganizationInvitation {
  if (typeof returned !== "object" || returned === null) return false;
  const row = returned as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.email === "string" &&
    typeof row.role === "string" &&
    typeof row.organizationId === "string" &&
    typeof row.inviterId === "string" &&
    row.status === "pending"
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** What `/organization/accept-invitation` returns when the invitee really joined. */
function isAcceptedInvitation(
  returned: unknown,
): returned is { invitation: AcceptedOrganizationInvitation; member: { userId: string } } {
  if (!isRecord(returned) || !isRecord(returned.invitation) || !isRecord(returned.member)) {
    return false;
  }
  return (
    typeof returned.invitation.inviterId === "string" &&
    typeof returned.invitation.organizationId === "string" &&
    typeof returned.member.userId === "string"
  );
}

/** What `/organization/update-member-role` returns: the updated member row. */
function isUpdatedMember(returned: unknown): returned is UpdatedOrganizationMember {
  return (
    isRecord(returned) &&
    typeof returned.userId === "string" &&
    typeof returned.organizationId === "string" &&
    typeof returned.role === "string"
  );
}

/** What `/organization/remove-member` returns: the member row it deleted. */
function isRemovedMember(returned: unknown): returned is { member: RemovedOrganizationMember } {
  return (
    isRecord(returned) &&
    isRecord(returned.member) &&
    typeof returned.member.userId === "string" &&
    typeof returned.member.organizationId === "string"
  );
}

/**
 * Backend reactions to Better Auth organization endpoints, which run outside our use
 * cases: the personal-workspace shield on `/organization/leave` (which fires none of the
 * plugin's own hooks), and the notifications after an invite, an accepted invitation, a
 * role change and a removal. Paths are matched by exact equality, so the decorators name
 * them verbatim.
 *
 * No auto-accept lives here any more: joining an organization is a deliberate act on
 * `/platform/account/invitations`, and only Better Auth's accept endpoint admits anybody.
 */
@Hook()
@Injectable()
export class OrganizationAuthHook {
  private readonly logger = new Logger(OrganizationAuthHook.name);

  constructor(
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    private readonly notifyInviteeUseCase: NotifyOrganizationInviteeUseCase,
    private readonly notifyInvitationAcceptedUseCase: NotifyOrganizationInvitationAcceptedUseCase,
    private readonly notifyRoleChangedUseCase: NotifyOrganizationRoleChangedUseCase,
    private readonly notifyMemberRemovedUseCase: NotifyOrganizationMemberRemovedUseCase,
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

  /**
   * The whole body is guarded: `runAfterHooks` rethrows anything that is not an
   * `APIError`, so a fault in here would 500 the request *after* the invitation row
   * was inserted and its email awaited.
   */
  @AfterHook("/organization/invite-member")
  async notifyInvitee(ctx: AuthHookContext) {
    try {
      // A refused invite — already invited, already a member, not allowed, a personal
      // workspace — still reaches after-hooks, with the `APIError` as `returned`.
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError || !isPendingInvitation(returned)) return;

      await this.notifyInviteeUseCase.execute(returned);
    } catch (error) {
      this.logger.warn({
        msg: "Failed to notify an invitee, the invitation stands",
        operation: "notify-invitee",
        error,
      });
    }
  }

  /**
   * The new member is the session user, so the inviter hears from them. Guarded like
   * `notifyInvitee`, and for the same reason: the membership row is already written.
   */
  @AfterHook("/organization/accept-invitation")
  async notifyInvitationAccepted(ctx: AuthHookContext) {
    try {
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError || !isAcceptedInvitation(returned)) return;

      const session = await getSessionFromCtx(ctx);
      if (!session) return;

      await this.notifyInvitationAcceptedUseCase.execute(returned.invitation, session.user.id);
    } catch (error) {
      this.logger.warn({
        msg: "Failed to tell the inviter, the new member is in",
        operation: "notify-invitation-accepted",
        error,
      });
    }
  }

  /** The returned row never names the caller; the session does. */
  @AfterHook("/organization/update-member-role")
  async notifyRoleChanged(ctx: AuthHookContext) {
    try {
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError || !isUpdatedMember(returned)) return;

      const session = await getSessionFromCtx(ctx);
      if (!session) return;

      await this.notifyRoleChangedUseCase.execute(returned, session.user.id);
    } catch (error) {
      this.logger.warn({
        msg: "Failed to tell the member, the role change stands",
        operation: "notify-role-changed",
        error,
      });
    }
  }

  @AfterHook("/organization/remove-member")
  async notifyMemberRemoved(ctx: AuthHookContext) {
    try {
      const returned: unknown = ctx.context.returned;
      if (returned instanceof APIError || !isRemovedMember(returned)) return;

      const session = await getSessionFromCtx(ctx);
      if (!session) return;

      await this.notifyMemberRemovedUseCase.execute(returned.member, session.user.id);
    } catch (error) {
      this.logger.warn({
        msg: "Failed to tell the removed member, the removal stands",
        operation: "notify-member-removed",
        error,
      });
    }
  }
}
