import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  desc,
  eq,
  experimentJoinRequests,
  inArray,
  profiles,
  resourceGrants,
  STAFFING_GRANT_ROLES,
  upsertGrant,
  users,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedEmail,
  getAnonymizedAvatarUrl,
} from "../../../common/utils/profile-anonymization";
import {
  assertResourceStaysStaffed,
  findOwningOrgOwnerIds,
} from "../../../sharing/resource-staffing";
import type {
  ExperimentJoinRequestDto,
  JoinRequestStatus,
} from "../models/experiment-join-request.model";

/**
 * The tier an approved join request confers: read plus data contribution —
 * "viewer", the same role the sharing UI writes for "Can view", so approved
 * requesters are indistinguishable from directly-added collaborators.
 */
const JOIN_APPROVAL_GRANT_ROLE = "viewer";

const joinRequestSelectFields = {
  id: experimentJoinRequests.id,
  experimentId: experimentJoinRequests.experimentId,
  message: experimentJoinRequests.message,
  status: experimentJoinRequests.status,
  decidedBy: experimentJoinRequests.decidedBy,
  decidedAt: experimentJoinRequests.decidedAt,
  createdAt: experimentJoinRequests.createdAt,
  updatedAt: experimentJoinRequests.updatedAt,
  user: {
    id: users.id,
    firstName: getAnonymizedFirstName(),
    lastName: getAnonymizedLastName(),
    email: getAnonymizedEmail(),
    avatarUrl: getAnonymizedAvatarUrl(),
  },
};

@Injectable()
export class ExperimentJoinRequestRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    experimentId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<ExperimentJoinRequestDto>> {
    return tryCatch(async () => {
      const inserted = await this.database
        .insert(experimentJoinRequests)
        .values({
          experimentId,
          userId,
          message: message ?? null,
        })
        .returning({ id: experimentJoinRequests.id });

      const result = await this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(experimentJoinRequests.id, inserted[0].id))
        .limit(1);

      return result[0];
    });
  }

  async findPendingByExperimentAndUser(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentJoinRequestDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            eq(experimentJoinRequests.experimentId, experimentId),
            eq(experimentJoinRequests.userId, userId),
            eq(experimentJoinRequests.status, "pending"),
          ),
        )
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async findById(id: string): Promise<Result<ExperimentJoinRequestDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(experimentJoinRequests.id, id))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }

  async listPendingByExperiment(experimentId: string): Promise<Result<ExperimentJoinRequestDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            eq(experimentJoinRequests.experimentId, experimentId),
            eq(experimentJoinRequests.status, "pending"),
          ),
        )
        .orderBy(desc(experimentJoinRequests.createdAt));
    });
  }

  /**
   * Approve a join request: mark it approved AND grant the requester access,
   * atomically.
   *
   * Approval hands out the **read-and-contribute tier** ("Can view"), which is
   * what joining an experiment means: the requester can open it and add
   * measurements and annotations, but not change the experiment or share it.
   *
   * The staffing guard runs inside this transaction rather than through the
   * sharing repository's own guarded write, because that would open a second
   * transaction and cost the approve its atomicity. Same guard, same locked row
   * set — the upsert can in principle lower an existing role, so it passes the
   * check like every other direct-grant write.
   */
  async approve(
    requestId: string,
    requesterUserId: string,
    experimentId: string,
    decidedBy: string,
  ): Promise<Result<ExperimentJoinRequestDto>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        await tx
          .update(experimentJoinRequests)
          .set({
            status: "approved",
            decidedBy,
            decidedAt: new Date(),
          })
          .where(eq(experimentJoinRequests.id, requestId));

        await assertResourceStaysStaffed(tx, {
          resourceType: "experiment",
          resourceId: experimentId,
          target: { by: "grantee", granteeType: "user", granteeId: requesterUserId },
          nextRole: JOIN_APPROVAL_GRANT_ROLE,
        });

        await upsertGrant(tx, {
          resourceType: "experiment",
          resourceId: experimentId,
          granteeType: "user",
          granteeId: requesterUserId,
          role: JOIN_APPROVAL_GRANT_ROLE,
          createdBy: decidedBy,
        });
      });

      const result = await this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(experimentJoinRequests.id, requestId))
        .limit(1);

      return result[0];
    });
  }

  async markDecided(
    requestId: string,
    status: Exclude<JoinRequestStatus, "pending">,
    decidedBy: string | null,
  ): Promise<Result<ExperimentJoinRequestDto>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentJoinRequests)
        .set({
          status,
          decidedBy,
          decidedAt: new Date(),
        })
        .where(eq(experimentJoinRequests.id, requestId));

      const result = await this.database
        .select(joinRequestSelectFields)
        .from(experimentJoinRequests)
        .innerJoin(users, eq(experimentJoinRequests.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(experimentJoinRequests.id, requestId))
        .limit(1);

      return result[0];
    });
  }

  /**
   * Returns email addresses of everyone who can decide a join request, so they are
   * the ones notified when one arrives: the holders of an admin/owner user grant
   * **plus the living owners of the experiment's owning organization**.
   *
   * The owners are not an embellishment — they are usually the only recipients.
   * A creator holds no grant on what they create, so an experiment sitting in its
   * creator's personal workspace has no admin grants at all, and sourcing this
   * from grants alone would silently notify nobody about every join request.
   *
   * Team/organization grants are excluded on purpose — there is no individual
   * mailbox behind them.
   */
  async listAdminEmails(experimentId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const [granted, ownerIds] = await Promise.all([
        this.database
          .select({ userId: resourceGrants.granteeId })
          .from(resourceGrants)
          .where(
            and(
              eq(resourceGrants.resourceType, "experiment"),
              eq(resourceGrants.resourceId, experimentId),
              eq(resourceGrants.granteeType, "user"),
              inArray(resourceGrants.role, [...STAFFING_GRANT_ROLES]),
            ),
          ),
        findOwningOrgOwnerIds(this.database, "experiment", experimentId),
      ]);

      // One mailbox per person: an owner who also holds an admin grant is in both
      // sets and must not be mailed twice.
      const recipientIds = [...new Set([...granted.map((row) => row.userId), ...ownerIds])];
      if (recipientIds.length === 0) {
        return [];
      }

      const rows = await this.database
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.id, recipientIds));

      return rows.map((row) => row.email);
    });
  }
}
