import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  asc,
  desc,
  eq,
  isNull,
  ne,
  notExists,
  or,
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
import { MEMBER_ADMISSION_PORT } from "../ports/member-admission.port";
import type { MemberAdmissionPort } from "../ports/member-admission.port";

/** The role an approved request confers. Approval admits, it does not promote. */
export const JOIN_APPROVAL_ORG_ROLE = "member";

export type CreateJoinRequestOutcome =
  | { outcome: "created"; request: OrganizationJoinRequestDto }
  | { outcome: "not-joinable" };

export type ApproveOrganizationJoinRequestOutcome =
  | { outcome: "approved"; request: OrganizationJoinRequestDto }
  | { outcome: "not-pending" }
  | { outcome: "organization-full" }
  | { outcome: "demo-organization" };

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
    @Inject(MEMBER_ADMISSION_PORT) private readonly members: MemberAdmissionPort,
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
      const inserted = await this.database
        .insert(organizationJoinRequests)
        .select(
          this.database
            // Drizzle 0.45 requires every insert-select column in schema order.
            .select({
              id: sql<string>`${organizationJoinRequests.id.default}`.as("id"),
              organizationId: organizations.id,
              userId: sql<string>`${userId}::uuid`.as("user_id"),
              message: sql<string | null>`${message ?? null}`.as("message"),
              status: sql<"pending">`${organizationJoinRequests.status.default}`.as("status"),
              decidedBy: sql<string | null>`null`.as("decided_by"),
              decidedAt: sql<Date | null>`null`.as("decided_at"),
              createdAt: sql<Date>`${organizationJoinRequests.createdAt.default}`.as("created_at"),
              updatedAt: sql<Date>`${organizationJoinRequests.updatedAt.default}`.as("updated_at"),
            })
            .from(organizations)
            .where(
              and(
                eq(organizations.id, organizationId),
                eq(organizations.visibility, "public"),
                or(isNull(organizations.type), ne(organizations.type, "demo")),
                isNotPersonalOrgSql(),
                notExists(
                  this.database
                    .select({ id: organizationMembers.id })
                    .from(organizationMembers)
                    .where(
                      and(
                        eq(organizationMembers.organizationId, organizations.id),
                        eq(organizationMembers.userId, userId),
                      ),
                    ),
                ),
              ),
            ),
        )
        .returning({ id: organizationJoinRequests.id });

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
   * Claim a pending request and admit the requester in one transaction, through
   * {@link MemberAdmissionPort.admit}: approving a request for somebody who joined meanwhile still
   * resolves the request instead of failing on the unique index — and never overwrites
   * the role they already hold — and an organization at its membership cap refuses
   * instead of being walked past it.
   *
   * Lock the organization before request/member rows so a concurrent Demo conversion
   * cannot pass the type check and then admit a requester into a Demo organization.
   * The claim comes before admission, so a request somebody else already decided admits
   * nobody. A cap refusal then puts it back: an approval the cap turned away is one the
   * reviewer can take again once a seat frees up, not a decision already recorded.
   */
  async approve(
    requestId: string,
    requesterUserId: string,
    organizationId: string,
    decidedBy: string,
  ): Promise<Result<ApproveOrganizationJoinRequestOutcome>> {
    return tryCatch(async () => {
      const claimed = await this.database.transaction(async (tx) => {
        const [organization] = await tx
          .select({ type: organizations.type })
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .for("update");
        if (!organization) return "not-pending" as const;
        if (organization.type === "demo") return "demo-organization" as const;

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
          return "not-pending" as const;
        }

        const admission = await this.members.admit(tx, {
          organizationId,
          userId: requesterUserId,
          role: JOIN_APPROVAL_ORG_ROLE,
        });

        if (admission === "organization-full") {
          // Undone in the same transaction rather than rolled back, so the refusal is
          // an answer the caller gets instead of a failure it has to interpret.
          await tx
            .update(organizationJoinRequests)
            .set({ status: "pending", decidedBy: null, decidedAt: null })
            .where(eq(organizationJoinRequests.id, requestId));
          return "organization-full" as const;
        }

        return "approved" as const;
      });

      if (claimed !== "approved") {
        return { outcome: claimed };
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
