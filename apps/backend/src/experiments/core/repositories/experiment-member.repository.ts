import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentMembers, inArray, users, profiles } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedEmail,
} from "../../../common/utils/profile-anonymization";
import { ExperimentMemberRole, ExperimentMemberDto } from "../models/experiment-members.model";

@Injectable()
export class ExperimentMemberRepository {
  constructor(
    @Inject("DATABASE_READER")
    private readonly reader: DatabaseInstance,
    @Inject("DATABASE_WRITER")
    private readonly writer: DatabaseInstance,
  ) {}

  async getMembers(experimentId: string): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      return this.reader
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(eq(experimentMembers.experimentId, experimentId));
    });
  }

  async addMembers(
    experimentId: string,
    members: { userId: string; role?: ExperimentMemberRole }[],
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      if (!members.length) return [];

      await this.writer.insert(experimentMembers).values(
        members.map((m) => ({
          experimentId,
          userId: m.userId,
          role: m.role,
        })),
      );

      const userIds = members.map((m) => m.userId);

      const result = await this.reader
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            inArray(experimentMembers.userId, userIds),
          ),
        );

      return result;
    });
  }

  async findUserFullNameFromProfile(
    userId: string,
  ): Promise<Result<{ firstName: string; lastName: string } | null>> {
    return tryCatch(async () => {
      const result = await this.reader
        .select({
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return {
        firstName: result[0].firstName,
        lastName: result[0].lastName,
      };
    });
  }

  async removeMember(experimentId: string, userId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.writer
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
      const membership = await this.reader
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

  async getAdminCount(experimentId: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const admins = await this.reader
        .select()
        .from(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.role, "admin"),
          ),
        );

      return admins.length;
    });
  }

  async updateMemberRole(
    experimentId: string,
    userId: string,
    role: ExperimentMemberRole,
  ): Promise<Result<ExperimentMemberDto>> {
    return tryCatch(async () => {
      await this.writer
        .update(experimentMembers)
        .set({ role })
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        );

      const result = await this.reader
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        )
        .limit(1);

      return result[0];
    });
  }
}
