import { z } from "zod";

// Define schema for environment variables
const envSchema = z.object({
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
});

// Parse environment variables
function parseEnv() {
  const parsed = envSchema.safeParse({
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
  });

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(parsed.error.format(), null, 4),
    );

    // Only throw in development/test to prevent production crashes
    if (process.env.NODE_ENV !== "production") {
      throw new Error("Invalid environment variables");
    }
  }

  return parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>);
}

// Export the parsed environment
export const env = parseEnv();

// For backwards compatibility
export async function getEnv() {
  return env;
}
