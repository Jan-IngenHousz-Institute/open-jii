import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgres://postgres:postgres@localhost:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "openjii_local"}`;

export default async function resetDatabase() {
  console.log("🗑️  Resetting database...");

  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    // Drop all database objects in the correct order
    console.log("Dropping all database objects...");

    // First, drop the drizzle schema (migration tracking)
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

    // Drop all custom types (enums) that might exist
    console.log("Dropping custom types...");

    // Get all custom enum types and drop them
    const customTypes = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typtype = 'e' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;

    for (const type of customTypes) {
      await sql`DROP TYPE IF EXISTS ${sql(type.typname)} CASCADE`;
    }

    // Drop all tables by dropping and recreating the public schema
    console.log("Dropping all tables...");
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`CREATE SCHEMA public`;

    // Restore default permissions
    await sql`GRANT ALL ON SCHEMA public TO postgres`;
    await sql`GRANT ALL ON SCHEMA public TO public`;

    console.log("✅ Database reset complete! All tables, types, and schemas have been dropped.");
    console.log("💡 You can now run 'pnpm db:migrate' to apply your migrations from scratch.");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Auto-run when executed directly
resetDatabase().catch(console.error);
