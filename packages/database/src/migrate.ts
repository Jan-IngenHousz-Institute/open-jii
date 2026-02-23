import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Build the migration connection URL using master credentials.
 *
 * In ECS the DB_CREDENTIALS secret is injected as a JSON string
 * containing the Aurora master username and password.
 * Locally, DATABASE_URL or the default postgres connection is used.
 */
function getMigrationUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { DB_HOST: host, DB_PORT: port, DB_NAME: name } = process.env;
  const credsEnv = process.env.DB_CREDENTIALS;

  if (credsEnv) {
    try {
      const credentials = JSON.parse(credsEnv) as {
        username: string;
        password: string;
      };
      const encodedPass = encodeURIComponent(credentials.password);
      return `postgres://${credentials.username}:${encodedPass}@${host}:${port}/${name}?sslmode=require`;
    } catch {
      throw new Error("Failed to parse DB_CREDENTIALS JSON");
    }
  }

  // Local dev fallback
  return `postgres://postgres:postgres@localhost:${port ?? "5432"}/${name ?? "openjii_local"}`;
}

async function runMigrations() {
  let exit = 0;
  const url = getMigrationUrl();
  const client = postgres(url, {
    max: 1,
    ssl: !url.includes("localhost"),
  });

  try {
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    exit = 1;
  } finally {
    await client.end();
    process.exit(exit);
  }
}

// Run the migration function
void runMigrations();
