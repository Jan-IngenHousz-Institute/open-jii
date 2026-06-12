import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  and,
  eq,
  experimentMembers,
  experiments,
  ilike,
  inArray,
  isNull,
  like,
  ne,
  profiles,
  users,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../../common/utils/fp-utils";

type SeedStatus = "active" | "archived";

interface SeedCase {
  suffix: string;
  status: SeedStatus;
  /** Number of mock users to add as plain members. */
  members: number;
  /** Add a mock user as a second admin — makes the experiment NOT a deletion blocker (a control). */
  secondAdmin: boolean;
}

// Covers every shape the delete-account flow has to handle. Experiments are named with the user's
// id so re-seeding across many test users never collides on the unique experiment name.
const SEED_CASES: SeedCase[] = [
  { suffix: "active-solo", status: "active", members: 0, secondAdmin: false },
  { suffix: "archived-solo", status: "archived", members: 0, secondAdmin: false },
  { suffix: "active-with-members", status: "active", members: 2, secondAdmin: false },
  { suffix: "archived-with-members", status: "archived", members: 2, secondAdmin: false },
  { suffix: "active-co-admin", status: "active", members: 0, secondAdmin: true },
];

/**
 * Dev-only helper to populate (and tear down) account-deletion test data. It creates one
 * experiment per case in {@link SEED_CASES} with the current user as admin, plus mock members /
 * a second admin where relevant. Members reuse existing mock profiles (avatar URL contains
 * "example"). Guarded to non-production by the controller.
 */
@Injectable()
export class SeedDeletionBlockersUseCase {
  private readonly logger = new Logger(SeedDeletionBlockersUseCase.name);

  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  /** Per-user, collision-proof name prefix. Note: contains no SQL LIKE wildcards. */
  private prefix(userId: string): string {
    return `[seed:${userId}] `;
  }

  async seed(userId: string): Promise<Result<{ created: number }>> {
    return tryCatch(async () => {
      // Reuse existing mock profiles as members (their avatars point at example URLs).
      const mockUsers = await this.database
        .select({ userId: profiles.userId })
        .from(profiles)
        .innerJoin(users, eq(profiles.userId, users.id))
        .where(
          and(
            ilike(profiles.avatarUrl, "%example%"),
            ne(profiles.userId, userId),
            isNull(profiles.deletedAt),
          ),
        )
        .limit(5);
      const mockUserIds = mockUsers.map((u) => u.userId);

      if (mockUserIds.length === 0) {
        this.logger.warn({
          msg: "No mock users (avatar containing 'example') found — seeding solo cases only",
          operation: "seed-deletion-blockers",
          userId,
        });
      }

      const prefix = this.prefix(userId);
      let created = 0;

      await this.database.transaction(async (tx) => {
        for (const seedCase of SEED_CASES) {
          const inserted = await tx
            .insert(experiments)
            .values({
              name: `${prefix}${seedCase.suffix}`,
              description: "Seeded for delete-account flow testing",
              status: seedCase.status,
              visibility: "public",
              createdBy: userId,
            })
            .onConflictDoNothing()
            .returning();

          // Name already taken (re-seed) — leave the existing one untouched.
          if (inserted.length === 0) continue;
          const experiment = inserted[0];
          created += 1;

          const memberRows: { experimentId: string; userId: string; role: "admin" | "member" }[] = [
            { experimentId: experiment.id, userId, role: "admin" },
          ];

          for (const memberId of mockUserIds.slice(0, seedCase.members)) {
            memberRows.push({ experimentId: experiment.id, userId: memberId, role: "member" });
          }
          if (seedCase.secondAdmin && mockUserIds[0]) {
            memberRows.push({ experimentId: experiment.id, userId: mockUserIds[0], role: "admin" });
          }

          await tx.insert(experimentMembers).values(memberRows).onConflictDoNothing();
        }
      });

      this.logger.log({
        msg: "Seeded deletion-blocker test experiments",
        operation: "seed-deletion-blockers",
        userId,
        created,
        status: "success",
      });

      return { created };
    });
  }

  async clear(userId: string): Promise<Result<{ deleted: number }>> {
    return tryCatch(async () => {
      const prefix = this.prefix(userId);
      const seeded = await this.database
        .select({ id: experiments.id })
        .from(experiments)
        .where(like(experiments.name, `${prefix}%`));

      if (seeded.length === 0) {
        return { deleted: 0 };
      }

      const ids = seeded.map((e) => e.id);
      await this.database.transaction(async (tx) => {
        // experiment_members has no cascade — remove memberships before the experiments.
        await tx.delete(experimentMembers).where(inArray(experimentMembers.experimentId, ids));
        await tx.delete(experiments).where(inArray(experiments.id, ids));
      });

      this.logger.log({
        msg: "Cleared seeded deletion-blocker test experiments",
        operation: "seed-deletion-blockers",
        userId,
        deleted: ids.length,
        status: "success",
      });

      return { deleted: ids.length };
    });
  }
}
