import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  ENVIRONMENT_PREFIX: z.string().optional().default("dev"),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional().default("http://localhost:3000"),
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
  CONTENTFUL_SPACE_ID: z.string().optional(),
  CONTENTFUL_ACCESS_TOKEN: z.string().optional(),
  CONTENTFUL_PREVIEW_ACCESS_TOKEN: z.string().optional(),
  CONTENTFUL_PREVIEW_SECRET: z.string().optional(),
  CONTENTFUL_SPACE_ENVIRONMENT: z.string().optional().default("master"),
  NEXT_PUBLIC_ENABLE_DEVTOOLS: z.enum(["true", "false"]).default("true"),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingKeys = error.errors.map((err) => err.path.join(".")).join(", ");
      throw new Error(`Invalid environment variables: ${missingKeys}`);
    }
    throw error;
  }
};

export const env = parseEnv();
