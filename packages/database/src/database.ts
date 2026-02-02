import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type ConnectionType = "writer" | "reader";

const getDatabaseUrl = (
  secrets?: Record<string, unknown>,
  connectionType: ConnectionType = "writer",
) => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const { DB_PORT: port, DB_NAME: name } = process.env;

  // Use appropriate host/endpoint based on connection type
  const host =
    connectionType === "reader"
      ? (process.env.DB_READER_HOST ?? process.env.DB_HOST)
      : (process.env.DB_WRITER_HOST ?? process.env.DB_HOST);

  const credentials = getCredentials(secrets, connectionType);

  if (!host || !port || !name || !credentials.user || !credentials.pass) {
    console.warn(`Database configuration incomplete for ${connectionType} connection`);
  }

  const encodedpass = encodeURIComponent(credentials.pass);
  return `postgres://${credentials.user}:${encodedpass}@${host ?? "host"}:${port ?? 5432}/${name ?? "db_name"}?sslmode=require`;
};

const getCredentials = (
  dbCredentials?: Record<string, unknown>,
  connectionType: ConnectionType = "writer",
): {
  user: string;
  pass: string;
} => {
  // Check for connection-specific credentials first
  const credentialsEnvVar =
    connectionType === "reader" ? "DB_READER_CREDENTIALS" : "DB_WRITER_CREDENTIALS";

  if (dbCredentials) {
    return {
      user: dbCredentials.username as string,
      pass: dbCredentials.password as string,
    };
  }

  // Try connection-specific credentials
  if (process.env[credentialsEnvVar]) {
    try {
      const credentials = JSON.parse(process.env[credentialsEnvVar]) as Record<string, string>;

      if (credentials.username && credentials.password) {
        return {
          user: credentials.username,
          pass: credentials.password,
        };
      }
    } catch {
      console.warn(`Failed to parse ${credentialsEnvVar}`);
    }
  }

  // Fall back to generic DB_CREDENTIALS (for backward compatibility)
  if (!process.env.DB_CREDENTIALS) {
    return { user: "", pass: "" };
  }

  try {
    const credentials = JSON.parse(process.env.DB_CREDENTIALS) as Record<string, string>;

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
};

export const getClient = (secrets?: Record<string, unknown>) =>
  postgres(getDatabaseUrl(secrets, "writer"), { max: 1 });

export const getReaderClient = (secrets?: Record<string, unknown>) =>
  postgres(getDatabaseUrl(secrets, "reader"), { max: 5 });

export const getWriterClient = (secrets?: Record<string, unknown>) =>
  postgres(getDatabaseUrl(secrets, "writer"), { max: 1 });

// Default client uses writer endpoint (backward compatibility)
export const db = drizzle({ client: getClient(), schema });

// Create separate database instances for read and write operations
export const dbWriter = drizzle({ client: getWriterClient(), schema });
export const dbReader = drizzle({ client: getReaderClient(), schema });

export type DatabaseInstance = typeof db;
