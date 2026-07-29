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
import { assertExperimentStaysStaffed } from "../../../sharing/experiment-staffing";
import type { InvitationDto } from "../models/user-invitation.model";

/**
 * The access tier an invitation confers on acceptance, stored as the
 * `resourceGrants` role the invitee will hold. `viewer` is read plus data
 * contribution; `admin` is full control.
 */
export interface InvitationTerms {
  tier: InvitationTier;
}

/** The tier an invitation grants when the caller did not choose one. */
export const DEFAULT_INVITATION_TIER: InvitationTier = "viewer";

/**
 * Read a stored tier. Anything that is not `admin` is the read-and-contribute
 * tier: that covers `viewer`, the historical name `member` written before the
 * tier was renamed (same meaning, so no backfill was needed), and any unexpected
 * value — for which the lower tier is also the safe answer.
 */
function normaliseTier(stored: string | null): InvitationTier {
  return stored === "admin" ? "admin" : "viewer";
}

/**
 * The DTO's `tier` is stored in the `invitations.role` column, kept under its
 * original name so no column rename was needed. Every read goes through this
 * projection and {@link normaliseTier}, so the rest of the app only ever sees the
 * current tier names.
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

/**
 * Shape returned by {@link invitationColumns}. The column types are wider than the
 * DTO's (the table also models platform invitations, which have no resource id),
 * so narrowing happens here, at the single point every read passes through.
 */
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
   * Revoke a **pending** invitation, claiming it atomically.
   *
   * The `status='pending'` predicate is what makes this safe against a concurrent
   * acceptance: whichever statement commits first takes the invitation out of
   * `pending`, and the other claims zero rows. Resolves to `false` when the claim
   * was lost, so the caller can report "already accepted/revoked" instead of
   * silently overwriting a terminal status.
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
   * Accept an invitation and apply its terms to the associated resource in one
   * transaction. Currently only supports experiment resources.
   *
   * Acceptance grants the invitation's tier as a grant, which
   * is the whole of what an invitation confers: the read-and-contribute tier lets
   * the invitee open the experiment and add data to it.
   *
   * Resolves to `false` when the invitation was no longer pending, in which case
   * nothing at all was applied.
   *
   * @param invitedBy authorship for the direct grant — the person who invited them
   */
  async acceptInvitation(
    invitationId: string,
    userId: string,
    _resourceType: "experiment",
    resourceId: string,
    invite: InvitationTerms,
    invitedBy: string,
  ): Promise<Result<boolean>> {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        // Claim the invitation as the FIRST statement: flipping the status is only
        // allowed from `pending`, so a concurrent revoke (or a duplicate acceptance)
        // that commits first leaves this claim matching zero rows. Applying the terms
        // afterwards inside the same transaction is what makes "terms applied ⇔
        // status accepted" hold — previously both sides updated by id alone, so an
        // acceptance could overwrite `revoked` and still grant access (N1).
        const claimed = await tx
          .update(invitations)
          .set({ status: "accepted" })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, "pending")))
          .returning({ id: invitations.id });

        if (claimed.length === 0) {
          // Someone else already revoked or accepted it. Apply nothing.
          return false;
        }

        // This is an upsert, so a `viewer` invitation accepted by someone who
        // already holds a direct `admin` grant would *demote* them. Run the shared
        // staffing guard inside this transaction so every path that can lower a
        // direct grant's role passes through one check.
        await assertExperimentStaysStaffed(tx, {
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

        return true;
      });
    });
  }
}
