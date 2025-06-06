import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentMembers, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  ExperimentMemberRole,
  ExperimentMemberDto,
} from "../models/experiment-members.model";

@Injectable()
export class ExperimentMemberRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async getMembers(
    experimentId: string,
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          experimentId: experimentMembers.experimentId,
          userId: experimentMembers.userId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            name: users.name,
            email: users.email,
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .where(eq(experimentMembers.experimentId, experimentId));
    });
  }

  async addMember(
    experimentId: string,
    userId: string,
    role: ExperimentMemberRole = "member",
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      // Insert the member
      const inserted = await this.database
        .insert(experimentMembers)
        .values({
          experimentId,
          userId,
          role,
        })
        .returning();

      // Fetch user info for the inserted user
      const [user] = await this.database
        .select({
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId));
      return inserted.length === 0
        ? []
        : [
            {
              experimentId: inserted[0].experimentId,
              userId: inserted[0].userId,
              role: inserted[0].role,
              joinedAt: inserted[0].joinedAt,
              user: {
                name: user.name ?? null,
                email: user.email ?? null,
              },
            },
          ];
    });
  }

  async removeMember(
    experimentId: string,
    userId: string,
  ): Promise<Result<void>> {
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
