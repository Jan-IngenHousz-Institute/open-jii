import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  ENVIRONMENT_PREFIX: z.string().optional().default("dev"),
  NEXT_PUBLIC_BASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ENABLE_DEVTOOLS: z.enum(["true", "false"]).default("true"),
  // PostHog configuration - Optional for development
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional().default("https://eu.i.posthog.com"),
  CONTENTFUL_SPACE_ID: z.string().optional(),
  CONTENTFUL_ACCESS_TOKEN: z.string().optional(),
  CONTENTFUL_PREVIEW_ACCESS_TOKEN: z.string().optional(),
  CONTENTFUL_PREVIEW_SECRET: z.string().optional(),
  CONTENTFUL_SPACE_ENVIRONMENT: z.string().optional().default("master"),
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
});

const parseEnv = () => {
  try {
    // In client components, process.env.NEXT_PUBLIC_* is replaced at build time
    // We need to access it directly to ensure proper bundling
    const rawEnv = {
      NODE_ENV: process.env.NODE_ENV,
      ENVIRONMENT_PREFIX: process.env.ENVIRONMENT_PREFIX,
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      VERCEL_AUTOMATION_BYPASS_SECRET: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
      CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
      CONTENTFUL_PREVIEW_ACCESS_TOKEN: process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN,
      CONTENTFUL_PREVIEW_SECRET: process.env.CONTENTFUL_PREVIEW_SECRET,
      CONTENTFUL_SPACE_ENVIRONMENT: process.env.CONTENTFUL_SPACE_ENVIRONMENT,
      NEXT_PUBLIC_ENABLE_DEVTOOLS: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS,
    };

    return envSchema.parse(rawEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingKeys = error.errors.map((err) => err.path.join(".")).join(", ");
      throw new Error(`Invalid environment variables: ${missingKeys}`);
    }
    throw error;
  }
};

export const env = parseEnv();
