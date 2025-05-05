import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "./env";
import * as schema from "./schema";

// Use our validated environment variables
export const client = postgres(env.server.DATABASE_URL);

export const db = drizzle({ client, schema });
export type DatabaseInstance = typeof db;
