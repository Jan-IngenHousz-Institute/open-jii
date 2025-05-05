import { z } from "zod";

import { createEnv } from "@repo/env";

// Compose DATABASE_URL if not explicitly provided
const derivedDatabaseUrl =
  process.env.DATABASE_URL ||
  (process.env.POSTGRES_USER &&
   process.env.POSTGRES_PASSWORD &&
   process.env.POSTGRES_HOST &&
   process.env.POSTGRES_PORT &&
   process.env.POSTGRES_DB
    ? `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`
    : undefined);

// Create database-specific environment schema
export const env = createEnv({
  server: {
    // Database configuration
    DATABASE_URL: z.string().url(),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.string().transform((val) => parseInt(val)),
  },
  client: {
    // No client-side environment variables for database package
  },
  runtimeEnv: {
    DATABASE_URL: derivedDatabaseUrl,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
