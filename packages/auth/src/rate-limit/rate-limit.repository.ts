import { and, authRateLimitCounters, eq, gt, lte, sql } from "@repo/database";
import type { DbOrTx } from "@repo/database";

type Counter = typeof authRateLimitCounters.$inferInsert;

const CLEANUP_INTERVAL_MS = 60_000;
const cleanupAfter = new WeakMap<DbOrTx, number>();

interface Consumption {
  key: string;
  route: string;
  now: Date;
  window: number;
  max: number;
  sliding: boolean;
}

export async function deleteExpiredRateLimitCounters(
  database: DbOrTx,
  { now, route }: { now: Date; route?: string },
): Promise<number> {
  const removed = await database
    .delete(authRateLimitCounters)
    .where(
      and(
        lte(authRateLimitCounters.expiresAt, now),
        route === undefined ? undefined : eq(authRateLimitCounters.route, route),
      ),
    )
    .returning({ key: authRateLimitCounters.key });
  return removed.length;
}

export async function readRateLimitCounter(database: DbOrTx, key: string, now: Date) {
  const counters = await database
    .select()
    .from(authRateLimitCounters)
    .where(and(eq(authRateLimitCounters.key, key), gt(authRateLimitCounters.expiresAt, now)));
  return counters.length > 0 ? counters[0] : null;
}

export async function writeRateLimitCounter(database: DbOrTx, counter: Counter) {
  await database
    .insert(authRateLimitCounters)
    .values(counter)
    .onConflictDoUpdate({
      target: authRateLimitCounters.key,
      set: { count: counter.count, lastRequest: counter.lastRequest, expiresAt: counter.expiresAt },
    });
}

export async function consumeRateLimitCounter(database: DbOrTx, input: Consumption) {
  const { key, route, now, window, max, sliding } = input;
  const expiry = new Date(now.getTime() + window * 1000);
  const table = authRateLimitCounters;
  if (now.getTime() >= (cleanupAfter.get(database) ?? 0)) {
    cleanupAfter.set(database, now.getTime() + CLEANUP_INTERVAL_MS);
    try {
      await deleteExpiredRateLimitCounters(database, { now });
    } catch (error) {
      cleanupAfter.delete(database);
      throw error;
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const accepted = await database
      .insert(table)
      .values({
        key,
        route,
        count: 1,
        lastRequest: now.getTime(),
        expiresAt: expiry,
      })
      .onConflictDoUpdate({
        target: table.key,
        set: {
          count: sql`case when ${table.expiresAt} <= ${now.toISOString()} then 1 else ${table.count} + 1 end`,
          lastRequest: now.getTime(),
          expiresAt: sliding
            ? expiry
            : sql`case when ${table.expiresAt} <= ${now.toISOString()} then ${expiry.toISOString()} else ${table.expiresAt} end`,
        },
        setWhere: sql`${table.expiresAt} <= ${now.toISOString()} or ${table.count} < ${max}`,
      })
      .returning({ key: table.key });
    if (accepted.length) return { allowed: true, retryAfter: null };
    const counter = await readRateLimitCounter(database, key, now);
    if (counter)
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((counter.expiresAt.getTime() - now.getTime()) / 1000)),
      };
  }
  throw new Error("Rate limit counter changed during consumption");
}
