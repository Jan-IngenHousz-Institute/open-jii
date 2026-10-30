import { Inject, Injectable } from "@nestjs/common";

import {
  GUEST_HOURLY_LIMIT,
  GUEST_LIFETIME_MS,
  GUEST_ORGANIZATION_HOURLY_LIMIT,
} from "@repo/api/shared/guest";
import { deleteStaleAnonymousRateLimits } from "@repo/auth/guest-retention";
import {
  and,
  asc,
  count,
  eq,
  guestUsage,
  guestOrganizationUsage,
  gt,
  inArray,
  lt,
  sessions,
  sql,
  users,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import {
  FOREIGN_KEY_VIOLATION,
  LOCK_NOT_AVAILABLE,
  postgresErrorCode,
} from "../../../common/utils/postgres-error";
import { GUEST_GRANT_CLEANUP_PORT } from "../../../sharing/core/ports/guest-grant-cleanup.port";
import type { GuestGrantCleanupPort } from "../../../sharing/core/ports/guest-grant-cleanup.port";
import type {
  GuestPurgeBatch,
  GuestPurgeCursor,
  GuestQuotaDecision,
  GuestQuotaKind,
} from "../models/guest.model";
import type { GuestDirectoryPort } from "../ports/guest-directory.port";
import type { GuestIdentityPort } from "../ports/guest-identity.port";

@Injectable()
export class GuestRepository implements GuestIdentityPort, GuestDirectoryPort {
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

  async findGuestIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.database
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), eq(users.isAnonymous, true)));
    return rows.map(({ id }) => id);
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
    organizationId: string,
    kind: GuestQuotaKind,
    now = new Date(),
  ): Promise<GuestQuotaDecision> {
    const hour = 60 * 60 * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / hour) * hour);
    const retryAfterSeconds = Math.ceil((windowStart.getTime() + hour - now.getTime()) / 1000);
    const exhausted = new Error("Organization guest quota exhausted");
    try {
      return await this.database.transaction(async (tx) => {
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
        if (issued.length === 0) return { allowed: false, retryAfterSeconds };
        const organizationIssued = await tx
          .insert(guestOrganizationUsage)
          .values({ organizationId, kind, windowStart, count: 1 })
          .onConflictDoUpdate({
            target: [
              guestOrganizationUsage.organizationId,
              guestOrganizationUsage.kind,
              guestOrganizationUsage.windowStart,
            ],
            set: { count: sql`${guestOrganizationUsage.count} + 1` },
            setWhere: lt(guestOrganizationUsage.count, GUEST_ORGANIZATION_HOURLY_LIMIT),
          })
          .returning({ count: guestOrganizationUsage.count });
        if (organizationIssued.length === 0) throw exhausted;
        return { allowed: true, retryAfterSeconds };
      });
    } catch (error) {
      if (error !== exhausted) throw error;
      return { allowed: false, retryAfterSeconds };
    }
  }

  /**
   * Purges up to `limit` expired guests after `after`, in one short transaction. Rows another
   * transaction holds are skipped and stay for the next night, so concurrent runs share the
   * work. The cursor passes every account the batch saw, deleted or not.
   */
  async purgeExpiredBatch(
    cutoff: Date,
    after: GuestPurgeCursor | null,
    limit: number,
  ): Promise<GuestPurgeBatch> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
      const expired = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.isAnonymous, true),
            lt(users.createdAt, cutoff),
            after ? gt(users.id, after.id) : undefined,
          ),
        )
        .orderBy(asc(users.id))
        .limit(limit)
        .for("update", { skipLocked: true });
      const last = expired.at(-1);
      const batch: GuestPurgeBatch = {
        cursor: last ? { id: last.id } : null,
        seen: expired.length,
        deletedIds: [],
        blocked: [],
        deferred: [],
      };
      if (!last) return batch;
      const ids = expired.map(({ id }) => id);
      try {
        batch.deletedIds = await tx.transaction((savepoint) => this.deleteGuests(savepoint, ids));
        return batch;
      } catch (error) {
        const code = postgresErrorCode(error);
        if (code === LOCK_NOT_AVAILABLE) {
          batch.deferred.push(...ids);
          return batch;
        }
        if (code !== FOREIGN_KEY_VIOLATION) throw error;
      }
      // Isolate RESTRICT failures, but release the shared connection at the first lock timeout.
      for (const [index, id] of ids.entries()) {
        try {
          batch.deletedIds.push(
            ...(await tx.transaction((account) => this.deleteGuests(account, [id]))),
          );
        } catch (error) {
          const code = postgresErrorCode(error);
          if (code === LOCK_NOT_AVAILABLE) {
            batch.deferred.push(...ids.slice(index));
            break;
          } else if (code === FOREIGN_KEY_VIOLATION) batch.blocked.push({ userId: id, error });
          else throw error;
        }
      }
      return batch;
    });
  }

  async countExpired(cutoff: Date): Promise<number> {
    const [row] = await this.database
      .select({ expired: count() })
      .from(users)
      .where(and(eq(users.isAnonymous, true), lt(users.createdAt, cutoff)));
    return row.expired;
  }

  deleteStaleRateLimits(cutoff: Date, limit: number): Promise<number> {
    return deleteStaleAnonymousRateLimits(this.database, cutoff, limit);
  }

  private async deleteGuests(executor: DbOrTx, ids: string[]): Promise<string[]> {
    await this.grants.removeUserGrants(executor, ids);
    const removed = await executor
      .delete(users)
      .where(and(inArray(users.id, ids), eq(users.isAnonymous, true)))
      .returning({ id: users.id });
    return removed.map(({ id }) => id);
  }
}
