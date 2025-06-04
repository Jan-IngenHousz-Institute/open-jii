import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { client, db } from "./database";

async function runMigrations() {
  // Get the connection string from environment variables
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Running migrations...");

  try {
    // Run the migrations
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1);
  } finally {
    // Close the postgres client
    await client.end();
  }
}

// Run the migration function
void runMigrations();
