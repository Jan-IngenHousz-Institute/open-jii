import { Inject, Injectable, Logger } from "@nestjs/common";
import { AfterHook, BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { eq, isPersonalOrgSlug, organizations } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { NotifyOrganizationInviteeUseCase } from "../../application/use-cases/notify-organization-invitee/notify-organization-invitee";
import type { CreatedOrganizationInvitation } from "../../application/use-cases/notify-organization-invitee/notify-organization-invitee";

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

/**
 * Backend reactions to Better Auth organization endpoints, which run outside our use
 * cases: the personal-workspace shield on `/organization/leave` (which fires none of the
 * plugin's own hooks) and the invitee notification after `/organization/invite-member`.
 * Paths are matched by exact equality, so the decorators name them verbatim.
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
}
