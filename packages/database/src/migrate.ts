import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { db, getClient } from "./database";

async function getWriterPasswordFromSecretsManager(): Promise<string | null> {
  const writerSecretArn = process.env.DB_WRITER_SECRET_ARN;
  const region = process.env.AWS_REGION ?? "eu-central-1";

  if (!writerSecretArn) {
    console.log("ℹ️  No DB_WRITER_SECRET_ARN found, skipping writer password setup");
    return null;
  }

  try {
    const client = new SecretsManagerClient({ region });
    const response = await client.send(new GetSecretValueCommand({ SecretId: writerSecretArn }));

    if (!response.SecretString) {
      console.warn("⚠️  Secret exists but has no SecretString");
      return null;
    }

    const secret = JSON.parse(response.SecretString) as {
      username: string;
      password: string;
    };
    return secret.password;
  } catch (error) {
    console.error("❌ Failed to fetch writer password from Secrets Manager:", error);
    return null;
  }
}

async function runMigrations() {
  let exit = 0;

  try {
    // Fetch writer password from Secrets Manager if available
    const writerPassword = await getWriterPasswordFromSecretsManager();

    if (writerPassword) {
      console.log("🔐 Setting writer password for migration...");
      // Set the password as a PostgreSQL session variable for use in migration 0019
      await getClient().unsafe(`SET app.writer_password = '${writerPassword.replace(/'/g, "''")}'`);
      console.log("✅ Writer password set successfully");
    }

    // Run the migrations
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Error running migrations:", error);
    exit = 1;
  } finally {
    // Close the postgres client
    await getClient().end();
    process.exit(exit);
  }
}

// Run the migration function
void runMigrations();
