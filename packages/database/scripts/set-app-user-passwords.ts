import "dotenv/config";
import {
    SecretsManagerClient,
    UpdateSecretCommand,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import crypto from "crypto";
import postgres from "postgres";

/**
 * Creates writer user, sets permissions, and stores credentials in Secrets Manager
 *
 * Security Model:
 * - Runtime (Backend): Uses DB_CREDENTIALS → openjii_writer (CRUD only)
 * - Migrations: Uses DB_ADMIN_CREDENTIALS → master/admin (full DDL)
 */

// Generate a cryptographically secure random password
function generateSecurePassword(length = 32): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const charsetLength = charset.length;
    // Largest multiple of charsetLength less than or equal to 256
    const maxMultiple = Math.floor(256 / charsetLength) * charsetLength;

    let password = "";
    while (password.length < length) {
        // Generate a batch of random bytes; batch size can be tuned as needed
        const values = crypto.randomBytes(length);
        for (let i = 0; i < values.length && password.length < length; i++) {
            const byte = values[i]!;
            // Use rejection sampling to avoid modulo bias
            if (byte < maxMultiple) {
                const index = byte % charsetLength;
                password += charset[index];
            }
        }
    }
    return password;
}

// Validate password contains only expected characters to prevent SQL injection
function validatePassword(password: string): void {
    const validChars = /^[a-zA-Z0-9!@#$%^&*]+$/;
    if (!validChars.test(password)) {
        throw new Error("Generated password contains invalid characters");
    }
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
    console.log("🔐 Setting up application database writer user...");

    const { DB_HOST: host, DB_PORT: port, DB_NAME: name, AWS_REGION: region } = process.env;

    if (!host || !port || !name) {
        console.error("❌ Database connection parameters incomplete");
        process.exit(1);
    }

    // Get secret ARN from environment (set by Terraform)
    const writerSecretArn = process.env.DB_SECRET_ARN || process.env.DB_WRITER_SECRET_ARN;

    if (!writerSecretArn) {
        console.error("❌ DB_SECRET_ARN not found in environment");
        process.exit(1);
    }

    // Initialize AWS Secrets Manager client
    const secretsClient = new SecretsManagerClient({ region: region || "eu-central-1" });

    // Check if password is already set by trying to get and use it
    console.log("Checking if writer user is already configured...");

    try {
        // Try to get existing credentials from Secrets Manager
        const writerSecretResponse = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: writerSecretArn }),
        );

        const writerCreds = JSON.parse(writerSecretResponse.SecretString || "{}");

        // Check if these credentials actually work (and aren't placeholders)
        if (
            writerCreds.password &&
            writerCreds.password !== "PLACEHOLDER_WILL_BE_SET_BY_MIGRATION_SCRIPT"
        ) {
            console.log("Testing existing credentials...");

            const writerWorks = await canAuthenticate(
                host,
                port,
                name,
                writerCreds.username,
                writerCreds.password,
            );

            if (writerWorks) {
                console.log("✅ Writer user is already configured and working");
                console.log("✅ Nothing to do - skipping user setup");
                return;
            }

            console.log("⚠️  Existing password found but not working - will recreate user");
        }
    } catch (error) {
        console.log("ℹ️  No valid credentials found in Secrets Manager - will create new user");
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
        // Generate secure password
        console.log("Generating secure password...");
        const writerPassword = generateSecurePassword(32);

        // Validate password before using in SQL (defense in depth)
        validatePassword(writerPassword);

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
        
        -- Grant default privileges for future tables created by the current user (master)
        ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openjii_writer;
        
        -- Grant default privileges for future sequences created by the current user (master)
        ALTER DEFAULT PRIVILEGES FOR ROLE CURRENT_USER IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO openjii_writer;
        
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

        // Grant privileges on drizzle schema for migration tracking
        await sql.unsafe(`
      DO $$
      BEGIN
        IF EXISTS(SELECT FROM pg_catalog.pg_namespace WHERE nspname = 'drizzle') THEN
          GRANT USAGE ON SCHEMA drizzle TO openjii_writer;
          GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO openjii_writer;
          RAISE NOTICE 'Granted drizzle schema access to openjii_writer';
        END IF;
      END $$;
        `);

        console.log("✅ Writer user has been set up successfully!");
        console.log("🔒 Password is securely stored in AWS Secrets Manager only");
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
