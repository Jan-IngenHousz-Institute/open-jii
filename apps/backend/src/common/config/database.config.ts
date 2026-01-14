import { registerAs } from "@nestjs/config";

import { getSecretsManager } from "../utils/secrets-manager";

export default registerAs("@repo/database", () => ({
  url: process.env.DATABASE_URL,
}));

/**
 * Fetch database credentials from AWS Secrets Manager
 * This is called at application startup to get fresh credentials
 */
export async function getDatabaseCredentials(): Promise<{
  username: string;
  password: string;
} | null> {
  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    console.warn("DB_SECRET_ARN not configured, using fallback credentials");
    return null;
  }

  try {
    const secretsManager = getSecretsManager(process.env.AWS_REGION);
    const credentials = await secretsManager.getDatabaseCredentials(secretArn);
    console.log("Successfully fetched database credentials from Secrets Manager");
    return credentials;
  } catch (error) {
    console.error("Failed to fetch database credentials from Secrets Manager:", error);
    // Return null to fall back to environment variables if available
    return null;
  }
}
