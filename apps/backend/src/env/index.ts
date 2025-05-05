import { z } from "zod";

import { createEnv } from "@repo/env";

// Create backend-specific environment schema
export const env = createEnv({
  server: {
    // Database configuration
    POSTGRES_DB: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.string().transform((val) => parseInt(val)),
    DATABASE_URL: z.string().url(),

    // Application settings
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z
      .string()
      .transform((val) => parseInt(val))
      .optional(),
    HOST: z.string().optional(),
  },
  client: {
    // By using `PUBLIC_` prefix, these can be safely exposed to the client
    // Add any client environment variables here
  },
  runtimeEnv: {
    // Database configuration
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    // Compose DATABASE_URL if not explicitly set
    DATABASE_URL:
      process.env.DATABASE_URL ||
      (process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_HOST && process.env.POSTGRES_PORT && process.env.POSTGRES_DB
        ? `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`
        : undefined),

    // Application settings
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
  },
  // Optional configuration
  clientPrefix: "PUBLIC_",
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

// Export type for better type safety when using env variables
export type Env = typeof env;
