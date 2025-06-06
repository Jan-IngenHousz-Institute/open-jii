import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentMembers, sql, users } from "@repo/database";
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
      const rows = await this.database
        .select({
          experimentId: experimentMembers.experimentId,
          userId: experimentMembers.userId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            name: sql<string>`COALESCE(${users.name}, '')`.as("name"),
            email: users.email,
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .where(eq(experimentMembers.experimentId, experimentId));

      // Map: ensure correct types and fields
      return rows.map((row) => {
        if (!row.userId) {
          throw new Error(
            "User not found for experiment member: " + JSON.stringify(row),
          );
        }
        return {
          experimentId: row.experimentId,
          userId: row.userId,
          role: row.role,
          joinedAt: row.joinedAt,
          user: {
            name: row.user.name,
            email: row.user.email ?? null,
          },
        };
      });
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
      const user = await this.database
        .select({
          name: sql<string>`COALESCE(${users.name}, '')`.as("name"),
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .then((rows) => rows[0]);

      // Return the enriched DTO
      return inserted.map((row) => ({
        experimentId: row.experimentId,
        userId: row.userId,
        role: row.role,
        joinedAt: row.joinedAt,
        user: {
          name: user.name,
          email: user.email ?? null,
        },
      }));
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
