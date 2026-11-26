import { createClient } from "@clickhouse/client";
import type { ClickHouseClient, ClickHouseSettings } from "@clickhouse/client";

/** A test store setting from .env.test, which the backend's `pnpm test` loads. */
export function storeSetting(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is unset; run the backend's tests through pnpm test`);
  }
  return value;
}

/** The test store's admin, which specs seed and empty it as. */
export function testStoreAdmin(settings: ClickHouseSettings = {}): ClickHouseClient {
  const url = storeSetting("SERVING_STORE_URL");
  const testPort = storeSetting("CLICKHOUSE_TEST_PORT");

  // Specs empty this store, and a shell's own SERVING_STORE_URL wins over .env.test.
  const { hostname, port } = new URL(url);
  const isOnThisMachine = ["127.0.0.1", "localhost"].includes(hostname);
  const isTestStore = isOnThisMachine && port === testPort;
  if (!isTestStore) {
    throw new Error(
      `Specs empty the store they use, so it must be the test store on this machine's port ${testPort}, not ${url}`,
    );
  }

  return createClient({
    url,
    username: storeSetting("CLICKHOUSE_TEST_USER"),
    password: storeSetting("CLICKHOUSE_TEST_PASSWORD"),
    database: "store",
    clickhouse_settings: settings,
  });
}

/** Empties every table of the test store but the migration ledger, so a spec reads only its rows. */
export async function emptyStore(admin: ClickHouseClient): Promise<void> {
  const result = await admin.query({
    query:
      "SELECT name FROM system.tables WHERE database = 'store' AND engine NOT IN ('View', 'MaterializedView') AND name != '_migrations'",
    format: "JSONEachRow",
  });
  for (const { name } of await result.json<{ name: string }>()) {
    await admin.command({ query: `TRUNCATE TABLE store.\`${name}\`` });
  }
}
