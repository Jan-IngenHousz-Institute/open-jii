import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Only load dotenv in non-Next.js environments
// Next.js handles environment variables differently
if (!process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
}

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;

  if (url) return url;

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const name = process.env.DB_NAME;

  // Handle DB_CREDENTIALS as a JSON string if available
  let username = "";
  let password = "";

  if (process.env.DB_CREDENTIALS) {
    try {
      // Parse DB_CREDENTIALS as JSON (coming from AWS Secrets Manager)
      const credentials = JSON.parse(process.env.DB_CREDENTIALS);
      username = credentials.username;
      password = encodeURIComponent(credentials.password);
    } catch {
      throw new Error(
        "Invalid DB_CREDENTIALS format. Please provide valid JSON with username and password fields.",
      );
    }
  } else {
    throw new Error("DB_CREDENTIALS environment variable is required.");
  }

  if (!host || !username || !password || !name || !port) {
    throw new Error(
      "Either DATABASE_URL or all required database configuration (host, credentials, name, port) must be set in the environment variables.",
    );
  }

  return `postgres://${username}:${password}@${host}:${port}/${name}?sslmode=require`;
};

export const client = postgres(getDatabaseUrl(), { max: 1 });

export const db = drizzle({ client, schema });
export type DatabaseInstance = typeof db;
