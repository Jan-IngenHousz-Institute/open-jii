import { sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

/** The Postgres backend serving a handle, for {@link waitUntilBlocked}. */
export async function backendPidOf(database: DatabaseInstance): Promise<number> {
  const [{ pid }] = await database.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
  return Number(pid);
}

/**
 * Resolves once backend `pid` is waiting on a lock, as seen from `observer`, which must be a
 * different connection. A race spec releases its holder only after this, so it cannot pass
 * without the contender ever waiting. Gives up under the test timeout, with this message.
 */
export async function waitUntilBlocked(
  observer: DatabaseInstance,
  pid: number,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [{ waiting }] = await observer.execute<{ waiting: number }>(
      sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE pid = ${pid} AND wait_event_type = 'Lock'`,
    );
    if (Number(waiting) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`backend ${pid} never waited on a lock`);
}
