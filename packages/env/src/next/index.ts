import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Next.js specific environment schema.
 * This extends the base environment schema with Next.js specific features
 * like differentiating between client and server environment variables.
 */
export const env = createEnv({
  /*
   * Server-side environment variables, not available on the client.
   * These will throw if accessed on the client.
   */
  server: {},

  /*
   * Environment variables available on the client (and server).
   * Must be prefixed with NEXT_PUBLIC_ to be exposed to the client.
   */
  client: {},

  /*
   * Due to how Next.js bundles environment variables on Edge and Client,
   * we need to manually destructure them to make sure all are included in bundle.
   */
  runtimeEnv: {},

  /**
   * Skip validation in production for performance
   */
  skipValidation:
    process.env.NODE_ENV === "production" || !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Makes empty strings be treated as undefined
   */
  emptyStringAsUndefined: true,
});
