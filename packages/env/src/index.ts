import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Define a type for our global env storage
declare global {
  var _env: any; // eslint-disable-line no-var
}

export const env = createEnv({
  /*
   * Specify your server-side environment variables schema here. This way you can ensure the app isn't
   * built with invalid env vars.
   */
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

  /**
   * Client-side environment variables. These will be exposed to the client, so be careful what you put here.
   */
  client: {
    // By using `PUBLIC_` prefix, these can be safely exposed to the client
  },

  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  runtimeEnv: {
    // Database configuration
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    DATABASE_URL: process.env.DATABASE_URL,

    // Application settings
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
  },

  /**
   * Enable client-side validation in development mode
   */
  clientPrefix: "PUBLIC_",

  /**
   * Optional additional validation
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
