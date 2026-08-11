import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  eq,
  gt,
  organizationInvitations,
  organizationMembers,
  teamMembers,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { normalizeOrgRole } from "../organization-access";

export interface PendingOrganizationInvitation {
  id: string;
  organizationId: string;
  role: string | null;
  teamId: string | null;
}

/** `not-pending` covers every reason the claim found nothing: already decided, or expired. */
export type AcceptOrganizationInvitationOutcome = "accepted" | "not-pending";

/**
 * The sign-in auto-accept path over Better Auth's `invitation` model.
 *
 * One of the two places where Nest writes a Better Auth model directly (the other
 * is join-request approval): the status flip and the member row have to land in one
 * transaction, and Better Auth's own accept endpoint needs a request from the
 * invitee — which is exactly what a user signing up from an invitation email does
 * not have yet.
 */
@Injectable()
export class OrganizationInvitationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * Live invitations for an email. Expiry is filtered here rather than retired as a
   * status: the row's lifecycle belongs to Better Auth, and an expired invitation
   * that stays `pending` is exactly what its own accept endpoint refuses too.
   */
  async findPendingByEmail(email: string): Promise<Result<PendingOrganizationInvitation[]>> {
    return tryCatch(() =>
      this.database
        .select({
          id: organizationInvitations.id,
          organizationId: organizationInvitations.organizationId,
          role: organizationInvitations.role,
          teamId: organizationInvitations.teamId,
        })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.email, email.toLowerCase()),
            eq(organizationInvitations.status, "pending"),
            gt(organizationInvitations.expiresAt, new Date()),
          ),
        ),
    );
  }

  /**
   * Claim the invitation and admit the invitee with the role it carries. Both
   * inserts tolerate a conflict, so accepting an invitation for somebody who is
   * already a member (or already on the team) resolves the invitation instead of
   * failing — and never overwrites the role they already hold.
   *
   * Expiry is re-tested in the claim predicate, not just in the lookup that found
   * this row: an invitation that lapses in between would otherwise be claimed and
   * grant membership after it stopped being valid. Failing the claim means the
   * member insert below never runs.
   */
  async accept(
    invitationId: string,
    userId: string,
  ): Promise<Result<AcceptOrganizationInvitationOutcome>> {
    return tryCatch(() =>
      this.database.transaction(async (tx) => {
        // One timestamp for the whole claim, so the predicate cannot disagree with
        // itself across statements.
        const claimTime = new Date();

        const claimed = await tx
          .update(organizationInvitations)
          .set({ status: "accepted" })
          .where(
            and(
              eq(organizationInvitations.id, invitationId),
              eq(organizationInvitations.status, "pending"),
              gt(organizationInvitations.expiresAt, claimTime),
            ),
          )
          .returning({
            organizationId: organizationInvitations.organizationId,
            role: organizationInvitations.role,
            teamId: organizationInvitations.teamId,
          });

        if (claimed.length === 0) {
          return "not-pending" as const;
        }

        const invitation = claimed[0];

        await tx
          .insert(organizationMembers)
          .values({
            organizationId: invitation.organizationId,
            userId,
            role: normalizeOrgRole(invitation.role),
          })
          .onConflictDoNothing();

        // An invitation may name a team; joining the organization then also means
        // joining that team, which is the whole point of a team invitation.
        if (invitation.teamId) {
          await tx
            .insert(teamMembers)
            .values({ teamId: invitation.teamId, userId })
            .onConflictDoNothing();
        }

        return "accepted" as const;
      }),
    );
  }
}
