import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentMembers, inArray, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ExperimentMemberRole, ExperimentMemberDto } from "../models/experiment-members.model";

@Injectable()
export class ExperimentMemberRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async getMembers(experimentId: string): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .where(eq(experimentMembers.experimentId, experimentId));
    });
  }

  async addMembers(
    experimentId: string,
    members: { userId: string; role?: ExperimentMemberRole }[],
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      if (!members.length) return [];

      await this.database.insert(experimentMembers).values(
        members.map((m) => ({
          experimentId,
          userId: m.userId,
          role: m.role,
        })),
      );

      const userIds = members.map((m) => m.userId);

      const result = await this.database
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            inArray(experimentMembers.userId, userIds),
          ),
        );

      return result;
    });
  }

  async removeMember(experimentId: string, userId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        );

      // Explicitly return void
      return undefined;
    });
  }

  async getMemberRole(
    experimentId: string,
    userId: string,
  ): Promise<Result<ExperimentMemberRole | null>> {
    return tryCatch(async () => {
      const membership = await this.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        )
        .limit(1);

      if (membership.length === 0) {
        return null;
      }

      return membership[0].role;
    });
  }
}
