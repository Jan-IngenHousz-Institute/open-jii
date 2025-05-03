import { z } from "zod";

// Define schema for server-side environment variables
const serverSchema = z.object({
  // Database configuration
  DATABASE_URL: z.string().url(),
  OPEN_AI_API_KEY: z.string().min(1).optional(),
});

// Define schema for client-side environment variables
const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

// Parse environment variables
function parseEnv() {
  // Server-side variables
  const parsedServer = serverSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
  });

  // Client-side variables
  const parsedClient = clientSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });

  // Merge both results
  if (!parsedServer.success || !parsedClient.success) {
    console.error(
      "❌ Invalid environment variables:",
      !parsedServer.success
        ? JSON.stringify(parsedServer.error.format(), null, 4)
        : //@ts-ignore
          JSON.stringify(parsedClient.error.format(), null, 4),
    );

    // Only throw in development/test to prevent production crashes
    if (process.env.NODE_ENV !== "production") {
      throw new Error("Invalid environment variables");
    }
  }

  return {
    ...(parsedServer.success ? parsedServer.data : {}),
    ...(parsedClient.success ? parsedClient.data : {}),
  } as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;
}

// Export the parsed environment
export const env = parseEnv();

// For backwards compatibility
export async function getNextEnv() {
  return env;
}
