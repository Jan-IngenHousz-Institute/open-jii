import "dotenv/config";

import { migrateClickHouse, readClickHouseConfig, waitForClickHouse } from "./clickhouse/migrate";
import { db } from "./postgres/database";
import { migratePostgres } from "./postgres/migrate";

async function runMigrations() {
  let exit = 0;

  try {
    // Checked before Postgres changes, so a misconfigured or unreachable store leaves both as they were.
    const clickhouse = readClickHouseConfig(process.env);
    if (clickhouse) {
      await waitForClickHouse(clickhouse);
    }

    await migratePostgres();
    console.log("Postgres migrations completed successfully");

    if (clickhouse) {
      await migrateClickHouse(clickhouse);
      console.log("ClickHouse migrations completed successfully");
    } else {
      console.log("No ClickHouse configured for this environment, so none migrated");
    }
  } catch (error) {
    console.error("Error running migrations:", error);
    exit = 1;
  } finally {
    await db.$client.end();
    process.exit(exit);
  }
}

void runMigrations();
