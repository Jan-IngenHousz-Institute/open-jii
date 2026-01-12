import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Only load dotenv in non-Next.js environments
// Next.js handles environment variables differently
if (!process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
}

interface DBCredentials {
  user: string;
  pass: string;
}

// In-memory cache for credentials with TTL to handle secret rotation
let cachedCredentials: DBCredentials | null = null;
let lastRefreshTime = 0;
const CREDENTIALS_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches fresh credentials from Secrets Manager (for ECS environments)
 * This is called automatically when authentication fails
 */
async function fetchFreshCredentials(): Promise<DBCredentials | null> {
  if (!process.env.DB_SECRET_ARN) {
    return null;
  }

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );

    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || "eu-central-1",
    });

    const command = new GetSecretValueCommand({
      SecretId: process.env.DB_SECRET_ARN,
    });

    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString || "{}");

    if (secret.username && secret.password) {
      cachedCredentials = {
        user: secret.username,
        pass: secret.password,
      };
      lastRefreshTime = Date.now();
      console.log("✅ Refreshed database credentials from Secrets Manager");
      return cachedCredentials;
    }
  } catch (error) {
    console.error("❌ Failed to fetch credentials from Secrets Manager:", error);
  }

  return null;
}

/**
 * Gets credentials with automatic refresh logic for secret rotation
 */
async function getCredentials(
  dbCredentials?: Record<string, unknown>,
  forceRefresh = false,
): Promise<DBCredentials> {
  // If credentials are passed directly, use them
  if (dbCredentials?.username && dbCredentials?.password) {
    return {
      user: dbCredentials.username as string,
      pass: dbCredentials.password as string,
    };
  }

  // Try to get cached credentials if still valid
  const now = Date.now();
  if (!forceRefresh && cachedCredentials && now - lastRefreshTime < CREDENTIALS_TTL) {
    return cachedCredentials;
  }

  // Try to fetch fresh credentials from Secrets Manager (ECS environment)
  const freshCreds = await fetchFreshCredentials();
  if (freshCreds) {
    return freshCreds;
  }

  // Fall back to environment variables (local development)
  if (process.env.DB_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.DB_CREDENTIALS) as Record<string, string>;
      if (credentials.username && credentials.password) {
        return {
          user: credentials.username,
          pass: credentials.password,
        };
      }
    } catch {
      console.error("Failed to parse DB_CREDENTIALS");
    }
  }

  console.warn("⚠️ No valid database credentials found");
  return { user: "", pass: "" };
}

async function getDatabaseUrl(
  secrets?: Record<string, unknown>,
  forceRefresh = false,
): Promise<string> {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { DB_HOST: host, DB_PORT: port, DB_NAME: name } = process.env;
  const credentials = await getCredentials(secrets, forceRefresh);

  if (!host || !port || !name || !credentials.user || !credentials.pass) {
    console.warn("Database configuration incomplete");
  }

  const encodedpass = encodeURIComponent(credentials.pass);
  return `postgres://${credentials.user}:${encodedpass}@${host ?? "host"}:${port ?? 5432}/${name ?? "db_name"}?sslmode=require`;
}

/**
 * Creates a database client with automatic retry on auth failures
 * Handles RDS secret rotation gracefully
 */
export async function getClient(
  secrets?: Record<string, unknown>,
  retryCount = 0,
): Promise<postgres.Sql> {
  const MAX_RETRIES = 3;
  const databaseUrl = await getDatabaseUrl(secrets, retryCount > 0);

  const client = postgres(databaseUrl, { max: 1 });

  // Test the connection and handle auth failures
  try {
    await client`SELECT 1`;
    return client;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };

    // Check if it's an authentication error
    const isAuthError =
      err.message?.includes("password authentication failed") ||
      err.code === "28P01" || // Invalid password
      err.code === "28000"; // Invalid authorization

    if (isAuthError && retryCount < MAX_RETRIES) {
      console.warn(
        `⚠️ Authentication failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Refreshing credentials...`,
      );

      // Close the failed connection
      await client.end();

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));

      // Retry with fresh credentials
      return getClient(secrets, retryCount + 1);
    }

    // If not an auth error or max retries reached, throw
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}

// Initialize db connection (will be awaited at startup)
let dbInstance: ReturnType<typeof drizzle> | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    const client = await getClient();
    dbInstance = drizzle({ client, schema });
  }
  return dbInstance;
};

// For backward compatibility, export a promise
export const db = await getDb();

export const lambdaDb = async (secrets: Record<string, unknown>) => {
  const client = await getClient(secrets);
  return drizzle({ client, schema });
};

export type DatabaseInstance = typeof db;
