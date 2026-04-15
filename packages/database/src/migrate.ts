import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getClient, db } from "./database";
import { setupGrafanaUser } from "./setup-grafana-user";

async function runMigrations() {
  let exit = 0;

  try {
    // Run schema migrations
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations completed successfully");

    // Set up the Grafana read-only user if credentials are provided.
    // Skipped in local dev where GRAFANA_DB_CREDENTIALS is not set.
    if (process.env.GRAFANA_DB_CREDENTIALS) {
      await setupGrafanaUser();
    } else {
      console.log("GRAFANA_DB_CREDENTIALS not set — skipping Grafana user setup");
    }
  } catch (error) {
    console.error("Error during migration/setup:", error);
    exit = 1;
  } finally {
    // Close the postgres client
    await getClient().end();
    process.exit(exit);
  }
}

// Run the migration function
void runMigrations();
