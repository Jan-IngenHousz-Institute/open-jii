import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  isNotPersonalOrgSql,
  organizationJoinRequests,
  organizationMembers,
  organizations,
  profiles,
  sql,
  users,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedAvatarUrl,
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import type {
  OrganizationJoinRequestDto,
  OrganizationJoinRequestStatus,
} from "../models/organization-join-request.model";

/** The role an approved request confers. Approval admits, it does not promote. */
export const JOIN_APPROVAL_ORG_ROLE = "member";

export type CreateJoinRequestOutcome =
  | { outcome: "created"; request: OrganizationJoinRequestDto }
  | { outcome: "not-joinable" };

export type ApproveOrganizationJoinRequestOutcome =
  | { outcome: "approved"; request: OrganizationJoinRequestDto }
  | { outcome: "not-pending" };

const joinRequestSelectFields = {
  id: organizationJoinRequests.id,
  organizationId: organizationJoinRequests.organizationId,
  message: organizationJoinRequests.message,
  status: organizationJoinRequests.status,
  decidedBy: organizationJoinRequests.decidedBy,
  decidedAt: organizationJoinRequests.decidedAt,
  createdAt: organizationJoinRequests.createdAt,
  updatedAt: organizationJoinRequests.updatedAt,
  user: {
    id: users.id,
    firstName: getAnonymizedFirstName(),
    lastName: getAnonymizedLastName(),
    email: getAnonymizedEmail(),
    avatarUrl: getAnonymizedAvatarUrl(),
  },
};

@Injectable()
export class OrganizationJoinRequestRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  private selectRequests() {
    return (
      this.database
        .select(joinRequestSelectFields)
        .from(organizationJoinRequests)
        .innerJoin(users, eq(organizationJoinRequests.userId, users.id))
        // A requester who has not finished onboarding has no profile row; the
        // anonymization expressions already render that as an unnamed user.
        .leftJoin(profiles, eq(profiles.userId, users.id))
    );
  }

  /**
   * Insert a pending request, but only while the organization is still one that
   * may be joined.
   *
   * The joinability rules are re-tested inside the insert's own source query
   * rather than trusted from a prior read: an owner flipping the organization to
   * private between the two would otherwise leave a pending request standing
   * against a private organization. `INSERT … SELECT … WHERE` makes the check and
   * the write a single statement, so there is no window to lose.
   *
   * A zero-row result means the organization stopped being joinable (or the caller
   * became a member); the caller re-reads to say which.
   */
  async createIfJoinable(
    organizationId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<CreateJoinRequestOutcome>> {
    return tryCatch(async () => {
      const inserted = await this.database.execute<{ id: string }>(sql`
        INSERT INTO ${organizationJoinRequests} ("organization_id", "user_id", "message")
        SELECT ${organizations.id}, ${userId}::uuid, ${message ?? null}
        FROM ${organizations}
        WHERE ${organizations.id} = ${organizationId}::uuid
          AND ${organizations.visibility} = 'public'
          AND ${isNotPersonalOrgSql()}
          AND NOT EXISTS (
            SELECT 1 FROM ${organizationMembers}
            WHERE ${organizationMembers.organizationId} = ${organizations.id}
              AND ${organizationMembers.userId} = ${userId}::uuid
          )
        RETURNING ${organizationJoinRequests.id}
      `);

      if (inserted.length === 0) {
        return { outcome: "not-joinable" as const };
      }

      const rows = await this.selectRequests()
        .where(eq(organizationJoinRequests.id, inserted[0].id))
        .limit(1);

      return { outcome: "created" as const, request: rows[0] };
    });
  }

  async findPendingByOrganizationAndUser(
    organizationId: string,
    userId: string,
  ): Promise<Result<OrganizationJoinRequestDto | null>> {
    return tryCatch(async () => {
      const rows = await this.selectRequests()
        .where(
          and(
            eq(organizationJoinRequests.organizationId, organizationId),
            eq(organizationJoinRequests.userId, userId),
            eq(organizationJoinRequests.status, "pending"),
          ),
        )
        .limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  async findById(id: string): Promise<Result<OrganizationJoinRequestDto | null>> {
    return tryCatch(async () => {
      const rows = await this.selectRequests().where(eq(organizationJoinRequests.id, id)).limit(1);

      return rows.length > 0 ? rows[0] : null;
    });
  }

  /** Pending first (that is the queue), then the decided history, newest first. */
  async listByOrganization(organizationId: string): Promise<Result<OrganizationJoinRequestDto[]>> {
    return tryCatch(() =>
      this.selectRequests()
        .where(eq(organizationJoinRequests.organizationId, organizationId))
        .orderBy(
          asc(sql`CASE WHEN ${organizationJoinRequests.status} = 'pending' THEN 0 ELSE 1 END`),
          desc(organizationJoinRequests.createdAt),
        ),
    );
  }

  /**
   * Claim a pending request and admit the requester in one transaction. The member
   * insert is conflict-tolerant, so approving a request for somebody who joined
   * meanwhile still resolves the request instead of failing on the unique index —
   * and never overwrites the role they already hold.
   */
  async approve(
    requestId: string,
    requesterUserId: string,
    organizationId: string,
    decidedBy: string,
  ): Promise<Result<ApproveOrganizationJoinRequestOutcome>> {
    return tryCatch(async () => {
      const claimed = await this.database.transaction(async (tx) => {
        const updated = await tx
          .update(organizationJoinRequests)
          .set({ status: "approved", decidedBy, decidedAt: new Date() })
          .where(
            and(
              eq(organizationJoinRequests.id, requestId),
              eq(organizationJoinRequests.status, "pending"),
            ),
          )
          .returning({ id: organizationJoinRequests.id });

        if (updated.length === 0) {
          return false;
        }

        await tx
          .insert(organizationMembers)
          .values({ organizationId, userId: requesterUserId, role: JOIN_APPROVAL_ORG_ROLE })
          .onConflictDoNothing();

        return true;
      });

      if (!claimed) {
        return { outcome: "not-pending" };
      }

      const rows = await this.selectRequests()
        .where(eq(organizationJoinRequests.id, requestId))
        .limit(1);

      return { outcome: "approved", request: rows[0] };
    });
  }

  /** Flip a pending request to a terminal status, claiming it in the same statement. */
  async markDecided(
    requestId: string,
    status: Exclude<OrganizationJoinRequestStatus, "pending">,
    decidedBy: string | null,
  ): Promise<Result<OrganizationJoinRequestDto | null>> {
    return tryCatch(async () => {
      const updated = await this.database
        .update(organizationJoinRequests)
        .set({ status, decidedBy, decidedAt: new Date() })
        .where(
          and(
            eq(organizationJoinRequests.id, requestId),
            eq(organizationJoinRequests.status, "pending"),
          ),
        )
        .returning({ id: organizationJoinRequests.id });

      if (updated.length === 0) {
        return null;
      }

      const rows = await this.selectRequests()
        .where(eq(organizationJoinRequests.id, requestId))
        .limit(1);

      return rows[0];
    });
  }
}
