import { Inject, Injectable } from "@nestjs/common";

import { GUEST_HOURLY_LIMIT } from "@repo/api/shared/guest";
import { deleteStaleAnonymousRateLimits } from "@repo/auth/guest-retention";
import { and, eq, guestUsage, gt, lt, sessions, sql, users } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import { GUEST_GRANT_CLEANUP_PORT } from "../../../sharing/core/ports/guest-grant-cleanup.port";
import type { GuestGrantCleanupPort } from "../../../sharing/core/ports/guest-grant-cleanup.port";
import { GUEST_LIFETIME_MS } from "../models/guest.model";
import type { GuestPurgeBatch, GuestQuotaDecision, GuestQuotaKind } from "../models/guest.model";
import type { GuestIdentityPort } from "../ports/guest-identity.port";

@Injectable()
export class GuestRepository implements GuestIdentityPort {
  constructor(
    @Inject("DATABASE") private readonly database: DatabaseInstance,
    @Inject(GUEST_GRANT_CLEANUP_PORT) private readonly grants: GuestGrantCleanupPort,
  ) {}

  async findIdentity(userId: string, executor: DbOrTx = this.database) {
    const identities = await executor
      .select({ id: users.id, isAnonymous: users.isAnonymous, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId));
    return identities.at(0) ?? null;
  }

  async hasSession(userId: string, token: string): Promise<boolean> {
    const [session] = await this.database
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return Boolean(session);
  }

  async takeQuota(
    userId: string,
    kind: GuestQuotaKind,
    now = new Date(),
  ): Promise<GuestQuotaDecision> {
    const hour = 60 * 60 * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / hour) * hour);
    const retryAfterSeconds = Math.ceil((windowStart.getTime() + hour - now.getTime()) / 1000);
    return this.database.transaction(async (tx) => {
      // Serialize against conversion and purge, not merely against another quota counter.
      const guests = await tx
        .select({ isAnonymous: users.isAnonymous, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId))
        .for("update");
      const guest = guests.at(0);
      if (!guest?.isAnonymous || now.getTime() - guest.createdAt.getTime() >= GUEST_LIFETIME_MS) {
        return { allowed: false, retryAfterSeconds };
      }
      const issued = await tx
        .insert(guestUsage)
        .values({ userId, kind, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [guestUsage.userId, guestUsage.kind, guestUsage.windowStart],
          set: { count: sql`${guestUsage.count} + 1` },
          setWhere: lt(guestUsage.count, GUEST_HOURLY_LIMIT),
        })
        .returning({ count: guestUsage.count });
      return { allowed: issued.length === 1, retryAfterSeconds };
    });
  }

  async purgeExpired(now = new Date()): Promise<GuestPurgeBatch> {
    return this.database.transaction(async (tx) => {
      const [lock] = await tx
        .select({ acquired: sql<boolean>`pg_try_advisory_xact_lock(2234)` })
        .from(sql`generate_series(1, 1)`);
      if (!lock.acquired)
        return { skipped: true, deleted: 0, rateLimitRowsDeleted: 0, blocked: [] };
      const cutoff = new Date(now.getTime() - GUEST_LIFETIME_MS);
      const expired = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.isAnonymous, true), lt(users.createdAt, cutoff)))
        .for("update");
      let deleted = 0;
      const blocked: unknown[] = [];
      for (const guest of expired) {
        try {
          // A savepoint keeps an unexpected RESTRICT row from retaining every other guest.
          deleted += await tx.transaction(async (account) => {
            await this.grants.removeUserGrants(account, guest.id);
            const removed = await account
              .delete(users)
              .where(and(eq(users.id, guest.id), eq(users.isAnonymous, true)))
              .returning({ id: users.id });
            return removed.length;
          });
        } catch (error) {
          blocked.push(error);
        }
      }
      const rateLimitRowsDeleted = await deleteStaleAnonymousRateLimits(tx, cutoff);
      return { skipped: false, deleted, rateLimitRowsDeleted, blocked };
    });
  }
}
