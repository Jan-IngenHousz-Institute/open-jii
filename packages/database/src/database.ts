import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Only load dotenv in non-Next.js environments
// Next.js handles environment variables differently
if (!process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
}

const getDatabaseUrl = (secrets?: Record<string, unknown>) => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { DB_HOST: host, DB_PORT: port, DB_NAME: name } = process.env;
  const credentials = getCredentials(secrets);

  if (!host || !port || !name || !credentials.user || !credentials.pass) {
    console.warn("Database configuration incomplete");
  }

  const encodedpass = encodeURIComponent(credentials.pass);
  return `postgres://${credentials.user}:${encodedpass}@${host}:${port}/${name}?sslmode=require`;
};
const getCredentials = (
  dbCredentials?: Record<string, unknown>,
): {
  user: string;
  pass: string;
} => {
  if (dbCredentials) {
    return {
      user: dbCredentials.user as string,
      pass: dbCredentials.pass as string,
    };
  }

  if (!process.env.DB_CREDENTIALS) {
    return { user: "", pass: "" };
  }

  try {
    return JSON.parse(process.env.DB_CREDENTIALS) as {
      user: string;
      pass: string;
    };
  } catch {
    return { user: "", pass: "" };
  }
};

export const getClient = (secrets?: Record<string, unknown>) =>
  postgres(getDatabaseUrl(secrets), { max: 1 });

export const db = drizzle({ client: getClient(), schema });

export const lambdaDb = (secrets: Record<string, unknown>) =>
  drizzle({ client: getClient(secrets), schema });

export type DatabaseInstance = typeof db;
