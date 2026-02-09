import "dotenv/config";
import {
    SecretsManagerClient,
    UpdateSecretCommand,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import crypto from "crypto";
import postgres from "postgres";

/**
 * Updates writer user password and stores credentials in Secrets Manager
 * 
 * Prerequisites: 
 * - Migration 0019_create_writer_user.sql must have been run first to create the user
 * - This script only updates the password to a secure value
 *
 * Security Model:
 * - Runtime (Backend): Uses DB_WRITER_CREDENTIALS → openjii_writer (CRUD only)
 * - Migrations: Uses DB_CREDENTIALS → master/admin (full DDL)
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
    }Updating writer user password...");

    const { DB_HOST: host, DB_PORT: port, DB_NAME: name, AWS_REGION: region } = process.env;

    if (!host || !port || !name) {
        console.error("❌ Database connection parameters incomplete");
        process.exit(1);
    }

    // Get secret ARN from environment (set by Terraform)
    const writerSecretArn = process.env.DB_SECRET_ARN || process.env.DB_WRITER_SECRET_ARN;

    if (!writerSecretArn) {
        console.error("❌ DB_WRITER_SECRET_ARN not found in environment");
        process.exit(1);
    }

    // Initialize AWS Secrets Manager client
    const secretsClient = new SecretsManagerClient({ region: region || "eu-central-1" });

    // Check if password is already set and working
    console.log("Checking if writer user password is already configured...");

    try {
        // Try to get existing credentials from Secrets Manager
        const writerSecretResponse = await secretsClient.send(
            new GetSecretValueCommand({ SecretId: writerSecretArn }),
        );

        const writerCreds = JSON.parse(writerSecretResponse.SecretString || "{}");

        // Check if these credentials work (and aren't placeholders)
        if (
            writerCreds.password &&
            writerCreds.password !== "PLACEHOLDER_WILL_BE_SET_BY_SCRIPT"
        ) {
            console.log("Testing existing credentials...");

            const writerWorks = await canAuthenticate(
                host,
                port,
                name,
                "openjii_writer",
                writerCreds.password,
            );

            if (writerWorks) {
                console.log("✅ Writer user password is already configured and working");
                console.log("✅ Nothing to do - skipping password update");
                return;
            }

            console.log("⚠️  Existing password found but not working - will update password");
        }
    } catch (error) {
        console.log("ℹ️  No valid credentials found in Secrets Manager - will set new password");
    }

    // Get master credentials for updating the user password
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
        // Verify that openjii_writer user exists (should be created by migration)
        const userExists = await sql`
            SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'openjii_writer'
        `;

        if (userExists.length === 0) {
            console.error("❌ openjii_writer user does not exist!");
            console.error("   Run migrations first: pnpm db:migrate");
            process.exit(1);
        }

        // Generate secure password
        console.log("Generating secure password...");
        const writerPassword = generateSecurePassword(32);

        // Validate password before using in SQL (defense in depth)
        validatePassword(writerPassword);

        // Update writer user password using parameterized query
        console.log("Updating openjii_writer password...");
        await sql.unsafe(`ALTER USER openjii_writer WITH PASSWORD '${writerPassword.replace(/'/g, "''")}'`);
        console.log("✅ Password updated in database");

        // Verify the new password works
        console.log("Verifying new credentials...");
        const passwordWorks = await canAuthenticate(host, port, name, "openjii_writer", writerPassword);

        if (!passwordWorks) {
            console.error("❌ Password was updated but authentication failed!");
            process.exit(1);
        }

        console.log("✅ New credentials verified");

        // Update Secrets Manager with writer credentials
        console.log("Updating Secrets Manager...");
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

        console.log("\n✅ Writer user password has been set successfully!");
        console.log("🔒 Password is securely stored in AWS Secrets Manager only");
    } catch (error) {
        console.error("❌ Error updating password
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
