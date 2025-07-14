import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { getClient, db } from "./database";

async function runMigrations() {
  try {
    // Run the migrations
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    // Close the postgres client
    await getClient().end();
  }
}

// Run the migration function
void runMigrations();
