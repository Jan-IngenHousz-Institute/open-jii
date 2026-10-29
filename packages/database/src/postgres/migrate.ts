import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db } from "./database";

const MIGRATIONS_FOLDER = "postgres/migrations";

export async function migratePostgres() {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
