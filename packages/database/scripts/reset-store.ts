import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

import {
  checkClickHouseMigrations,
  migrateClickHouse,
  waitForClickHouse,
} from "../src/clickhouse/migrate";
import type { ClickHouseConfig } from "../src/clickhouse/migrate";

function testSetting(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is unset; run this through pnpm env:test`);
  }
  return value;
}

// The test store by the variables .env.test gives its compose service.
const STORE: ClickHouseConfig = {
  url: `http://127.0.0.1:${testSetting("CLICKHOUSE_TEST_PORT")}`,
  username: testSetting("CLICKHOUSE_TEST_USER"),
  password: testSetting("CLICKHOUSE_TEST_PASSWORD"),
};

/** The reader the backend reads as, with the access the serving store module gives prod's. */
const READER = z
  .object({
    name: z.string(),
    views: z.array(z.string()),
    tables: z.array(z.string()),
    rowFilter: z.string().nullable(),
    settings: z.array(z.string()),
  })
  .parse(JSON.parse(readFileSync(resolve(__dirname, "../test-store/reader.json"), "utf-8")));

async function run(admin: ClickHouseClient, statements: string[]): Promise<void> {
  for (const query of statements) {
    await admin.command({ query });
  }
}

/** Gives the reader its profile, grants and row policies afresh, on the store just migrated. */
async function createReader(admin: ClickHouseClient): Promise<void> {
  const { name, views, tables, rowFilter, settings } = READER;
  const profile = `${name}_profile`;
  await run(admin, [
    `DROP USER IF EXISTS ${name}`,
    `DROP SETTINGS PROFILE IF EXISTS ${profile}`,
    ...tables.map((table) => `DROP ROW POLICY IF EXISTS ${name}_rows ON store.${table}`),
    `CREATE SETTINGS PROFILE ${profile} SETTINGS ${settings.join(", ")}`,
    `CREATE USER ${name} IDENTIFIED BY '${STORE.password}' SETTINGS PROFILE '${profile}'`,
    ...[...views, ...tables].map((granted) => `GRANT SELECT ON store.${granted} TO ${name}`),
    ...(rowFilter === null
      ? []
      : tables.map(
          (table) =>
            `CREATE ROW POLICY ${name}_rows ON store.${table} USING ${rowFilter} TO ${name}`,
        )),
  ]);
}

export default async function resetStore() {
  await waitForClickHouse(STORE);

  const admin = createClient(STORE);
  try {
    await admin.command({ query: "DROP DATABASE IF EXISTS store SYNC" });
    await checkClickHouseMigrations();
    await migrateClickHouse(STORE);
    await createReader(admin);
  } finally {
    await admin.close();
  }
  console.log(`Test store reset, migrated and readable as ${READER.name}`);
}

resetStore().catch((error: unknown) => {
  console.error("Error resetting the test store:", error);
  process.exit(1);
});
