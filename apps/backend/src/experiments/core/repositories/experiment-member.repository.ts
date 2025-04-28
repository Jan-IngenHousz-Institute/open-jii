import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch, AppError } from "../../utils/fp-utils";
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
    return tryCatch(() =>
      this.database
        .select()
        .from(experimentMembers)
        .where(eq(experimentMembers.experimentId, experimentId)),
    );
  }

  async addMember(
    experimentId: string,
    userId: string,
    role: ExperimentMemberRole = "member",
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      // Check if membership already exists
      const existingMembership = await this.database
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        )
        .limit(1);

      if (existingMembership.length > 0) {
        // Membership already exists, return it without updating (no duplicate memberships)
        return [existingMembership[0]];
      }

      // Otherwise create a new membership
      return await this.database
        .insert(experimentMembers)
        .values({
          experimentId,
          userId,
          role,
        })
        .returning();
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

      return membership[0].role as ExperimentMemberRole;
    });
  }
}
