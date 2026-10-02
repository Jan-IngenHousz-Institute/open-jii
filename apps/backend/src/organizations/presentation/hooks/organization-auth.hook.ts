import { Inject, Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { eq, isPersonalOrgSlug, organizations, sql, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";

/** The invitation row Better Auth returns from a successful create. */
interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  inviterId: string;
}

/**
 * What `/organization/invite-member` returns when it really created an invitation.
 * Anything else — a refusal, a shape a future Better Auth returns instead — is left
 * alone rather than guessed at.
 */
function isPendingInvitation(returned: unknown): returned is PendingInvitation {
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

/**
 * Better Auth's organization hooks cover create/update/delete, members,
 * invitations and teams — but `/organization/leave` fires none of them, so the
 * personal-workspace shield for that one path has to be hand-rolled here. The
 * path is matched by exact equality (the adapter has no wildcards), so these
 * decorators name their endpoints verbatim.
 *
 * The same reason brings the invitation notification here: Better Auth creates the
 * invitation inside `packages/auth`, so none of the backend's use cases run and the
 * only seam left is the endpoint itself.
 *
 * This class also used to carry an auto-accept that claimed an invitee's pending
 * organization invitations on every sign-in, which meant somebody joined an
 * organization by logging in rather than by agreeing to. Accepting an invitation is a
 * deliberate act on `/platform/account/invitations`, and Better Auth's own accept
 * endpoint is the only thing that admits anybody.
 */
@Hook()
@Injectable()
export class OrganizationAuthHook {
  private readonly logger = new Logger(OrganizationAuthHook.name);

  constructor(
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    private readonly notifications: NotificationDispatchService,
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
   * Tells an invitee who already has an account that they were invited, and sends
   * them the invitation email through dispatch so their saved "Requests and
   * invitations" preference governs it. An invitee with no account is not reachable
   * by dispatch at all and was emailed by `packages/auth` before this ran; they hear
   * about it on their first sign-in instead.
   *
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

      const inviteeId = await this.findUserIdByEmail(returned.email);
      if (!inviteeId) return;

      const organizationName = await this.findOrganizationName(returned.organizationId);
      if (organizationName === null) return;

      const dispatched = await this.notifications.dispatch({
        type: "organization_invitation_received",
        recipientIds: [inviteeId],
        actorId: returned.inviterId,
        resource: { type: "organization", id: returned.organizationId },
        params: { organizationName, role: returned.role },
        // Both producers key on the invitation id, so somebody who hears at invite
        // time hears nothing again when they next sign in.
        dedupeKey: `organization_invitation_received:${returned.id}`,
      });

      if (dispatched.isFailure()) {
        this.logger.error({
          msg: "Failed to notify an invitee, the invitation stands",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "notify-invitee",
          invitationId: returned.id,
          error: dispatched.error,
        });
      }
    } catch (error) {
      this.logger.warn({
        msg: "Failed to notify an invitee, the invitation stands",
        operation: "notify-invitee",
        error,
      });
    }
  }

  /**
   * Compared lowercased: Better Auth lowercases the invitation email, but an account
   * created through an OAuth provider may carry mixed case. This is the backend half
   * of the predicate `hasAccountForEmail` applies in `packages/auth` — the two decide
   * who sends the invitation email, and must agree.
   */
  private async findUserIdByEmail(email: string): Promise<string | null> {
    const rows = await this.database
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return rows[0]?.id ?? null;
  }

  /** One select rather than the organization repository: the hook needs the name alone. */
  private async findOrganizationName(organizationId: string): Promise<string | null> {
    const rows = await this.database
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return rows[0]?.name ?? null;
  }
}
