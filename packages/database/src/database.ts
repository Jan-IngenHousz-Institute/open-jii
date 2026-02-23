import { Signer } from "@aws-sdk/rds-signer";
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Determine whether to use AWS IAM token authentication.
 * IAM auth is used when DB_USER and AWS_REGION are set
 * and no DATABASE_URL override is provided.
 */
function useIamAuth(): boolean {
  return !!(process.env.DB_USER && process.env.AWS_REGION && !process.env.DATABASE_URL);
}

/**
 * Build a password-based connection URL.
 * Used for local development when DATABASE_URL is set,
 * or as a fallback from individual env vars + DB_WRITER_CREDENTIALS / DB_CREDENTIALS.
 */
function getPasswordAuthUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { DB_HOST: host, DB_PORT: port, DB_NAME: name } = process.env;
  const credentials = parseCredentials();

  if (!host || !port || !name || !credentials.user || !credentials.pass) {
    console.warn("Database configuration incomplete");
  }

  const encodedPass = encodeURIComponent(credentials.pass);
  return `postgres://${credentials.user}:${encodedPass}@${host ?? "host"}:${port ?? 5432}/${name ?? "db_name"}?sslmode=require`;
}

/**
 * Parse credentials from DB_WRITER_CREDENTIALS or DB_CREDENTIALS env vars.
 * These contain JSON strings injected by ECS from Secrets Manager.
 */
function parseCredentials(): { user: string; pass: string } {
  const credsEnv = process.env.DB_WRITER_CREDENTIALS ?? process.env.DB_CREDENTIALS;

  if (!credsEnv) {
    return { user: "", pass: "" };
  }

  try {
    const credentials = JSON.parse(credsEnv) as Record<string, string>;

    if (credentials.username && credentials.password) {
      return {
        user: credentials.username,
        pass: credentials.password,
      };
    }

    return { user: "", pass: "" };
  } catch {
    return { user: "", pass: "" };
  }
}

/**
 * Create the postgres-js client.
 *
 * In AWS environments (DB_USER + AWS_REGION set, no DATABASE_URL):
 *   Uses IAM token authentication via Signer.
 *   The `password` callback generates a fresh 15-minute token for
 *   every new connection, so expired tokens are never reused.
 *
 * Locally / CI (DATABASE_URL or DB_CREDENTIALS set):
 *   Falls back to standard password-based authentication.
 */
function createClient() {
  if (useIamAuth()) {
    const host = process.env.DB_HOST ?? "localhost";
    const port = Number(process.env.DB_PORT ?? 5432);
    const username = process.env.DB_USER ?? "";
    const database = process.env.DB_NAME ?? "";
    const region = process.env.AWS_REGION ?? "eu-central-1";

    const signer = new Signer({
      hostname: host,
      port,
      region,
      username,
    });

    return postgres({
      host,
      port,
      database,
      username,
      password: async () => signer.getAuthToken(),
      ssl: "require",
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  // Password-based auth (local dev / CI / explicit DATABASE_URL)
  const url = getPasswordAuthUrl();
  return postgres(url, {
    max: 1,
    ssl: !url.includes("localhost"),
  });
}

const client = createClient();

export const getClient = () => client;

export const db = drizzle({ client, schema });

export type DatabaseInstance = typeof db;
