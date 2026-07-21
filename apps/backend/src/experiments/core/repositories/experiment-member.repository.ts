import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  eq,
  experimentMembers,
  inArray,
  resourceGrants,
  users,
  profiles,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedEmail,
  getAnonymizedAvatarUrl,
} from "../../../common/utils/profile-anonymization";
import { ExperimentMemberRole, ExperimentMemberDto } from "../models/experiment-members.model";

@Injectable()
export class ExperimentMemberRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  // Lists an experiment's members; `activeOnly` excludes deactivated ("Unknown") accounts.
  async getMembers(
    experimentId: string,
    { activeOnly = false }: { activeOnly?: boolean } = {},
  ): Promise<Result<ExperimentMemberDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
            avatarUrl: getAnonymizedAvatarUrl(),
          },
        })
        .from(experimentMembers)
        .innerJoin(users, eq(experimentMembers.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.userId))
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            activeOnly ? eq(profiles.activated, true) : undefined,
          ),
        );
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

      // Mirror membership into resource_grants so can() authorizes members
      // (admin -> full control, member -> read). experiment_members itself
      // remains only the contributor layer (measurements/annotations).
      for (const m of members) {
        await this.upsertMemberGrant(experimentId, m.userId, m.role);
      }

      const userIds = members.map((m) => m.userId);

      const result = await this.database
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
            avatarUrl: getAnonymizedAvatarUrl(),
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
      const result = await this.database
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
      await this.database
        .delete(experimentMembers)
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        );

      // Revoke the mirrored resource grant so access is removed via can().
      await this.database
        .delete(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "experiment"),
            eq(resourceGrants.resourceId, experimentId),
            eq(resourceGrants.granteeType, "user"),
            eq(resourceGrants.granteeId, userId),
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

  async getAdminCount(experimentId: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const admins = await this.database
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
      await this.database
        .update(experimentMembers)
        .set({ role })
        .where(
          and(
            eq(experimentMembers.experimentId, experimentId),
            eq(experimentMembers.userId, userId),
          ),
        );

      // Keep the mirrored resource grant in sync with the new role.
      await this.upsertMemberGrant(experimentId, userId, role);

      const result = await this.database
        .select({
          experimentId: experimentMembers.experimentId,
          role: experimentMembers.role,
          joinedAt: experimentMembers.joinedAt,
          user: {
            id: users.id,
            firstName: getAnonymizedFirstName(),
            lastName: getAnonymizedLastName(),
            email: getAnonymizedEmail(),
            avatarUrl: getAnonymizedAvatarUrl(),
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

  /**
   * Upsert the resource grant that mirrors an experiment membership. Experiment
   * admins get an "admin" grant (full control via can()); members get a
   * "member" grant (read-only). This keeps resource_grants the single
   * authorization source while experiment_members stays the contributor layer.
   */
  private async upsertMemberGrant(
    experimentId: string,
    userId: string,
    role: ExperimentMemberRole | undefined,
  ): Promise<void> {
    const grantRole = role === "admin" ? "admin" : "member";
    await this.database
      .insert(resourceGrants)
      .values({
        resourceType: "experiment",
        resourceId: experimentId,
        granteeType: "user",
        granteeId: userId,
        role: grantRole,
      })
      .onConflictDoUpdate({
        target: [
          resourceGrants.resourceType,
          resourceGrants.resourceId,
          resourceGrants.granteeType,
          resourceGrants.granteeId,
        ],
        set: { role: grantRole },
      });
  }
}
