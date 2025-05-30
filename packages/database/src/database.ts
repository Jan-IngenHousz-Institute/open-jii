import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Only load dotenv in non-Next.js environments
// Next.js handles environment variables differently
if (!process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
}

const getEnvVariable = (name: string) => {
  const value = process.env[name];
  if (value == null) throw new Error(`environment variable ${name} not found`);
  return value;
};

export const client = postgres(getEnvVariable("DATABASE_URL"), { max: 1 });

export const db = drizzle({ client, schema });
export type DatabaseInstance = typeof db;
