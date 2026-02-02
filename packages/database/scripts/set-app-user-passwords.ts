import "dotenv/config";
import {
    SecretsManagerClient,
    UpdateSecretCommand,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import crypto from "crypto";
import postgres from "postgres";

/**
 * AWS setup script to create application users with passwords
 * Creates users, sets permissions, and stores credentials in Secrets Manager
 *
 * IDEMPOTENT: Safe to run multiple times - will skip if users already exist and work
 */

// Generate a cryptographically secure random password
function generateSecurePassword(length = 32): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const values = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset[values[i]! % charset.length];
    }
    return password;
}

// Check if a user can authenticate with given credentials
async function canAuthenticate(
    host: string,
    port: string,
    dbName: string,
    username: string,
    password: string,
): Promise<boolean> {
    try {
        const encodedPass = encodeURIComponent(password);
        const testUrl = `postgres://${username}:${encodedPass}@${host}:${port}/${dbName}?sslmode=require`;
        const testSql = postgres(testUrl, { max: 1, connect_timeout: 5 });

        // Try a simple query
        await testSql`SELECT 1`;
        await testSql.end();
        return true;
    } catch (error) {
        return false;
    }
}

async function setApplicationUserPasswords() {
    console.log("🔐 Setting up application database users...");

    const { DB_HOST: host, DB_PORT: port, DB_NAME: name, AWS_REGION: region } = process.env;

    if (!host || !port || !name) {
        console.error("❌ Database connection parameters incomplete");
        process.exit(1);
    }

    // Get secret ARNs from environment (these are set by Terraform)
    const writerSecretArn = process.env.DB_WRITER_SECRET_ARN;
    const readerSecretArn = process.env.DB_READER_SECRET_ARN;

    if (!writerSecretArn || !readerSecretArn) {
        console.error("❌ Secret ARNs not found in environment");
        process.exit(1);
    }

    // Initialize AWS Secrets Manager client
    const secretsClient = new SecretsManagerClient({ region: region || "us-east-1" });

    // Check if passwords are already set by trying to get and use them
    console.log("Checking if users are already configured...");

    try {
        // Try to get existing credentials from Secrets Manager
        const [writerSecretResponse, readerSecretResponse] = await Promise.all([
            secretsClient.send(new GetSecretValueCommand({ SecretId: writerSecretArn })),
            secretsClient.send(new GetSecretValueCommand({ SecretId: readerSecretArn })),
        ]);

        const writerCreds = JSON.parse(writerSecretResponse.SecretString || "{}");
        const readerCreds = JSON.parse(readerSecretResponse.SecretString || "{}");

        // Check if these credentials actually work (and aren't placeholders)
        if (
            writerCreds.password &&
            writerCreds.password !== "PLACEHOLDER_WILL_BE_SET_BY_MIGRATION_SCRIPT" &&
            readerCreds.password &&
            readerCreds.password !== "PLACEHOLDER_WILL_BE_SET_BY_MIGRATION_SCRIPT"
        ) {
            console.log("Testing existing credentials...");

            const [writerWorks, readerWorks] = await Promise.all([
                canAuthenticate(host, port, name, writerCreds.username, writerCreds.password),
                canAuthenticate(host, port, name, readerCreds.username, readerCreds.password),
            ]);

            if (writerWorks && readerWorks) {
                console.log("✅ Application users are already configured and working");
                console.log("✅ Nothing to do - skipping user setup");
                return;
            }

            console.log("⚠️  Existing passwords found but not working - will recreate users");
        }
    } catch (error) {
        console.log("ℹ️  No valid credentials found in Secrets Manager - will create new users");
    }

    // Get master credentials for setting up users
    const masterCredentials = process.env.DB_CREDENTIALS
        ? JSON.parse(process.env.DB_CREDENTIALS)
        : null;

    if (!masterCredentials) {
        console.error("❌ DB_CREDENTIALS not found. Cannot connect to database.");
        process.exit(1);
    }

    // Connect using master credentials
    const encodedMasterPass = encodeURIComponent(masterCredentials.password);
    const masterUrl = `postgres://${masterCredentials.username}:${encodedMasterPass}@${host}:${port}/${name}?sslmode=require`;

    const sql = postgres(masterUrl, { max: 1 });

    try {
        // Generate secure passwords
        console.log("Generating secure passwords...");
        const writerPassword = generateSecurePassword(32);
        const readerPassword = generateSecurePassword(32);

        // Create writer role and user
        console.log("Creating openjii_writer user...");
        await sql.unsafe(`
      DO $$
      BEGIN
        -- Create writer role if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'openjii_writer') THEN
          CREATE ROLE openjii_writer WITH LOGIN PASSWORD '${writerPassword.replace(/'/g, "''")}';
          RAISE NOTICE 'Created openjii_writer role';
        ELSE
          -- Update password if user exists
          EXECUTE 'ALTER USER openjii_writer WITH PASSWORD ''' || '${writerPassword.replace(/'/g, "''")}' || '''';
          RAISE NOTICE 'Updated openjii_writer password';
        END IF;

        -- Grant connect privilege
        EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO openjii_writer';
        
        -- Grant usage on public schema
        GRANT USAGE ON SCHEMA public TO openjii_writer;
        
        -- Grant privileges on all existing tables
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openjii_writer;
        
        -- Grant privileges on all sequences
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO openjii_writer;
        
        -- Grant default privileges for future tables
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openjii_writer;
        
        -- Grant default privileges for future sequences
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO openjii_writer;
        
        RAISE NOTICE 'Granted writer privileges to openjii_writer';
      END $$;
    `);
        console.log("✅ openjii_writer user created in database");

        // Update Secrets Manager with writer credentials
        console.log("Updating Secrets Manager with writer credentials...");
        await secretsClient.send(
            new UpdateSecretCommand({
                SecretId: writerSecretArn,
                SecretString: JSON.stringify({
                    username: "openjii_writer",
                    password: writerPassword,
                }),
            }),
        );
        console.log("✅ Writer credentials updated in Secrets Manager");

        // Create reader role and user
        console.log("Creating openjii_reader user...");
        await sql.unsafe(`
      DO $$
      BEGIN
        -- Create reader role if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'openjii_reader') THEN
          CREATE ROLE openjii_reader WITH LOGIN PASSWORD '${readerPassword.replace(/'/g, "''")}';
          RAISE NOTICE 'Created openjii_reader role';
        ELSE
          -- Update password if user exists
          EXECUTE 'ALTER USER openjii_reader WITH PASSWORD ''' || '${readerPassword.replace(/'/g, "''")}' || '''';
          RAISE NOTICE 'Updated openjii_reader password';
        END IF;

        -- Grant connect privilege
        EXECUTE 'GRANT CONNECT ON DATABASE ' || current_database() || ' TO openjii_reader';
        
        -- Grant usage on public schema
        GRANT USAGE ON SCHEMA public TO openjii_reader;
        
        -- Grant SELECT privilege on all existing tables
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO openjii_reader;
        
        -- Grant default privileges for future tables
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO openjii_reader;
        
        RAISE NOTICE 'Granted reader privileges to openjii_reader';
      END $$;
    `);
        console.log("✅ openjii_reader user created in database");

        // Update Secrets Manager with reader credentials
        console.log("Updating Secrets Manager with reader credentials...");
        await secretsClient.send(
            new UpdateSecretCommand({
                SecretId: readerSecretArn,
                SecretString: JSON.stringify({
                    username: "openjii_reader",
                    password: readerPassword,
                }),
            }),
        );
        console.log("✅ Reader credentials updated in Secrets Manager");

        // Grant privileges on drizzle schema for migration tracking
        await sql.unsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'drizzle') THEN
          GRANT USAGE ON SCHEMA drizzle TO openjii_writer, openjii_reader;
          GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO openjii_writer, openjii_reader;
          RAISE NOTICE 'Granted drizzle schema access to application users';
        END IF;
      END $$;
    `);

        console.log("✅ All application users have been set up successfully!");
        console.log("🔒 Passwords are securely stored in AWS Secrets Manager only");
    } catch (error) {
        console.error("❌ Error setting up users:", error);
        throw error;
    } finally {
        await sql.end();
    }
}

// Auto-run when executed directly
setApplicationUserPasswords().catch((error) => {
    console.error(error);
    process.exit(1);
});
