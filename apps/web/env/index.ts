import { z } from "zod";

import { createEnv } from "@repo/env";

// Create web-specific environment schema for Next.js
export const env = createEnv({
  server: {
    // Server-only environment variables
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url().optional(),
  },
  client: {
    // Client-exposed environment variables (must have PUBLIC_ prefix)
    APP_URL: z.string().url().optional(),
    API_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    // Map process.env to our schema
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,

    // Public variables
    PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Optional configuration
  clientPrefix: "PUBLIC_",
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
