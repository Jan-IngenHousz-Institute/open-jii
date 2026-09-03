import { Injectable, Inject } from "@nestjs/common";

import type { InvitationTier } from "@repo/api/domains/user/user.schema";
import {
  and,
  eq,
  invitations,
  profiles,
  experiments,
  resourceGrants,
  upsertGrant,
  users,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { assertResourceStaysStaffed } from "../../../sharing/core/resource-staffing";
import type { InvitationDto } from "../models/user-invitation.model";

/** The tier an invitation confers, stored as the grant role the invitee will hold. */
export interface InvitationTerms {
  tier: InvitationTier;
}

/** What an acceptance attempt settled on. See {@link InvitationRepository.acceptInvitation}. */
export type AcceptInvitationOutcome = "accepted" | "not-pending" | "resource-archived";

/**
 * Anything but `admin` reads as the lower tier. Total by design: an invitation whose
 * stored tier cannot be resolved is still a real invitation, so it renders at the
 * lower tier rather than throwing.
 */
function normaliseTier(stored: string | null): InvitationTier {
  return stored === "admin" ? "admin" : "viewer";
}

/**
 * `tier` lives in the `invitations.role` column, which stores the grant-role
 * spelling. Reads go through {@link normaliseTier} so an unresolvable stored value
 * still renders as an invitation rather than throwing.
 */
const invitationColumns = {
  id: invitations.id,
  resourceType: invitations.resourceType,
  resourceId: invitations.resourceId,
  email: invitations.email,
  storedTier: invitations.role,
  status: invitations.status,
  invitedBy: invitations.invitedBy,
  createdAt: invitations.createdAt,
  updatedAt: invitations.updatedAt,
};

/** Wider than the DTO — the table also models platform invitations with no resource id. */
interface InvitationRow {
  storedTier: string | null;
  [key: string]: unknown;
}

function toDto({ storedTier, ...rest }: InvitationRow): InvitationDto {
  return { ...rest, tier: normaliseTier(storedTier) } as InvitationDto;
}

@Injectable()
export class InvitationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    resourceType: "experiment",
    resourceId: string,
    email: string,
    invite: InvitationTerms,
    invitedBy: string,
  ): Promise<Result<InvitationDto>> {
    return tryCatch(async () => {
      const result = await this.database
        .insert(invitations)
        .values({
          resourceType,
          resourceId,
          email: email.toLowerCase(),
          role: invite.tier,
          invitedBy,
        })
        .returning(invitationColumns);

      return toDto(result[0]);
    });
  }

  async findPendingByResourceAndEmail(
    resourceType: "experiment",
    resourceId: string,
    email: string,
  ): Promise<Result<InvitationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(invitationColumns)
        .from(invitations)
        .where(
          and(
            eq(invitations.resourceType, resourceType),
            eq(invitations.resourceId, resourceId),
            eq(invitations.email, email.toLowerCase()),
            eq(invitations.status, "pending"),
          ),
        )
        .limit(1);

      return result.length > 0 ? toDto(result[0]) : null;
    });
  }

  async findById(id: string): Promise<Result<InvitationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(invitationColumns)
        .from(invitations)
        .where(eq(invitations.id, id))
        .limit(1);

      return result.length > 0 ? toDto(result[0]) : null;
    });
  }

  async listByResource(
    resourceType: "experiment",
    resourceId: string,
  ): Promise<Result<InvitationDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          ...invitationColumns,
          inviterFirstName: profiles.firstName,
          inviterLastName: profiles.lastName,
          resourceName: experiments.name,
        })
        .from(invitations)
        .leftJoin(profiles, eq(invitations.invitedBy, profiles.userId))
        .leftJoin(experiments, eq(invitations.resourceId, experiments.id))
        .where(
          and(
            eq(invitations.resourceType, resourceType),
            eq(invitations.resourceId, resourceId),
            eq(invitations.status, "pending"),
          ),
        );

      return rows.map(({ inviterFirstName, inviterLastName, resourceName, ...invitation }) => ({
        ...toDto(invitation),
        invitedByName:
          inviterFirstName && inviterLastName
            ? `${inviterFirstName} ${inviterLastName}`
            : undefined,
        resourceName: resourceName ?? undefined,
      }));
    });
  }

  /**
   * Revoke a pending invitation, claiming it atomically. The `status='pending'`
   * predicate is what makes it safe against a concurrent acceptance — whoever commits
   * first wins, the other claims zero rows. `false` means the claim was lost.
   */
  async revoke(id: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const claimed = await this.database
        .update(invitations)
        .set({ status: "revoked" })
        .where(and(eq(invitations.id, id), eq(invitations.status, "pending")))
        .returning({ id: invitations.id });

      return claimed.length > 0;
    });
  }

  /**
   * Resolves the human-readable name of a resource.
   * Currently only supports experiment resources.
   */
  async findResourceName(_resourceType: "experiment", resourceId: string): Promise<Result<string>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ name: experiments.name })
        .from(experiments)
        .where(eq(experiments.id, resourceId))
        .limit(1);

      if (result.length === 0) {
        throw new Error(`Resource not found: ${resourceId}`);
      }

      return result[0].name;
    });
  }

  /**
   * Find all pending invitations for a given email address.
   * Used when a new user registers to automatically accept their invitations.
   */
  async findPendingByEmail(email: string): Promise<Result<InvitationDto[]>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(invitationColumns)
        .from(invitations)
        .where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.status, "pending")));

      return result.map(toDto);
    });
  }

  /**
   * Whether the email belongs to a user who already holds a grant on the
   * experiment — i.e. inviting them would confer nothing new.
   */
  async isEmailAlreadyGranted(resourceId: string, email: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ userId: users.id })
        .from(users)
        .innerJoin(
          resourceGrants,
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, resourceId),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, users.id),
          ),
        )
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      return result.length > 0;
    });
  }

  /**
   * Accept an invitation and write its tier as a grant, in one transaction —
   * experiments only. `invitedBy` becomes the grant's author.
   *
   * - `accepted` — the tier was applied.
   * - `not-pending` — it was revoked or accepted by someone else first; nothing applied.
   * - `resource-archived` — the experiment was archived before this landed, so the
   *   invitation was retired instead of granted.
   */
  async acceptInvitation(
    invitationId: string,
    userId: string,
    _resourceType: "experiment",
    resourceId: string,
    invite: InvitationTerms,
    invitedBy: string,
  ): Promise<Result<AcceptInvitationOutcome>> {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        // Claim first: a concurrent revoke or duplicate acceptance that commits
        // before this leaves it matching zero rows. Applying the terms afterwards in
        // the same transaction is what makes "terms applied ⇔ accepted" hold.
        const claimed = await tx
          .update(invitations)
          .set({ status: "accepted" })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, "pending")))
          .returning({ id: invitations.id });

        if (claimed.length === 0) {
          // Someone else already revoked or accepted it. Apply nothing.
          return "not-pending";
        }

        // An archived experiment refuses grant writes, so a grant minted here would
        // be one nobody could ever revoke and the grantee could not leave. Archival
        // is a plain update of this row, so `FOR UPDATE` either waits for it and then
        // reads the new status, or holds it off until this transaction commits.
        const target = await tx
          .select({ status: experiments.status })
          .from(experiments)
          .where(eq(experiments.id, resourceId))
          .limit(1)
          .for("update");

        // A missing experiment is not refused here, matching the archived guard on the
        // sharing write paths: the pre-transaction authorization check already answers
        // not-found for a resource that is gone.
        if (target.length > 0 && target[0].status === "archived") {
          // Retire it rather than granting: the invitation's authority went with the
          // experiment's mutability, the same way it goes with a demoted inviter's.
          await tx
            .update(invitations)
            .set({ status: "revoked" })
            .where(eq(invitations.id, invitationId));
          return "resource-archived";
        }

        // The upsert can demote: a `viewer` invitation accepted by an existing
        // direct `admin`. Same guard as every other role-lowering path.
        await assertResourceStaysStaffed(tx, {
          resourceType: "experiment",
          resourceId,
          target: { by: "grantee", granteeType: "user", granteeId: userId },
          nextRole: invite.tier,
        });

        await upsertGrant(tx, {
          resourceType: "experiment",
          resourceId,
          granteeType: "user",
          granteeId: userId,
          role: invite.tier,
          createdBy: invitedBy,
        });

        return "accepted";
      });
    });
  }
}
