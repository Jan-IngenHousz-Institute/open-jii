import "dotenv/config";

import {
  checkClickHouseMigrations,
  migrateClickHouse,
  readClickHouseConfig,
  waitForClickHouse,
} from "./clickhouse/migrate";
import { db } from "./postgres/database";
import { migratePostgres } from "./postgres/migrate";

async function runMigrations() {
  let exit = 0;

  try {
    // Set from the migrations workflow, so a Postgres change can ship while the store is down.
    const skipClickHouse = process.env.SKIP_CLICKHOUSE_MIGRATIONS === "true";
    const clickhouse = skipClickHouse ? null : readClickHouseConfig(process.env);

    // The store first, so a store migration that fails leaves Postgres, and with it the running
    // backend, as they were.
    if (clickhouse) {
      await checkClickHouseMigrations();
      await waitForClickHouse(clickhouse);
      await migrateClickHouse(clickhouse);
      console.log("ClickHouse migrations completed successfully");
    } else if (skipClickHouse) {
      console.log("ClickHouse migrations skipped on request");
    } else {
      console.log("No ClickHouse configured for this environment, so none migrated");
    }

    await migratePostgres();
    console.log("Postgres migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    exit = 1;
  } finally {
    await db.$client.end();
    process.exit(exit);
  }
}

void runMigrations();
