import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  desc,
  eq,
  experimentJoinRequests,
  experimentMembers,
  profiles,
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
import type {
  ExperimentJoinRequestDto,
  JoinRequestStatus,
} from "../models/experiment-join-request.model";

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
   * Approve a join request: mark approved AND insert into experimentMembers atomically.
   * If the user is somehow already a member, the member insert is a no-op.
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

        await tx
          .insert(experimentMembers)
          .values({
            experimentId,
            userId: requesterUserId,
            role: "member",
          })
          .onConflictDoNothing();
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
   * Returns email addresses (lowercased) of all admins of the experiment.
   */
  async listAdminEmails(experimentId: string): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ email: users.email })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.role, "admin"),
          ),
        );

      return result.map((row) => row.email);
    });
  }
}
