import { Inject, Injectable } from "@nestjs/common";
import { BeforeHook, Hook } from "@thallesp/nestjs-better-auth";
import type { AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";

import { eq, isPersonalOrgSlug, organizations } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

/**
 * Better Auth's organization hooks cover create/update/delete, members,
 * invitations and teams — but `/organization/leave` fires none of them, so the
 * personal-workspace shield for that one path has to be hand-rolled here. The
 * path is matched by exact equality (the adapter has no wildcards), so this
 * decorator names the endpoint verbatim.
 *
 * That shield is now the whole of this class. It also used to carry an auto-accept
 * that claimed an invitee's pending organization invitations on every sign-in, which
 * meant somebody joined an organization by logging in rather than by agreeing to.
 * Accepting an invitation is a deliberate act on `/platform/accept-invitation/[id]`,
 * and Better Auth's own accept endpoint is the only thing that admits anybody.
 */
@Hook()
@Injectable()
export class OrganizationAuthHook {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

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
}
