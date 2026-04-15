import "dotenv/config";
import postgres from "postgres";

interface GrafanaCredentials {
  username: string;
  password: string;
}

function getGrafanaCredentials(): GrafanaCredentials {
  const raw = process.env.GRAFANA_DB_CREDENTIALS;
  if (raw) {
    const parsed = JSON.parse(raw) as GrafanaCredentials;
    if (parsed.username && parsed.password) return parsed;
  }
  throw new Error("GRAFANA_DB_CREDENTIALS env var is required (JSON with username and password)");
}

/**
 * Escapes a string for use as a PostgreSQL quoted identifier ("name").
 * Doubles any double-quotes inside the identifier.
 */
function pgIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Escapes a string for use as a PostgreSQL single-quoted literal ('value').
 * Doubles any single-quotes inside the value.
 */
function pgLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function setupGrafanaUser(): Promise<void> {
  const { username, password } = getGrafanaCredentials();
  const dbName = process.env.DB_NAME;

  if (!dbName) throw new Error("DB_NAME env var is required");

  // Connect with master credentials (same env vars as migrate.ts)
  const { DB_HOST: host, DB_PORT: port, DB_NAME: name, DB_CREDENTIALS } = process.env;
  if (!host || !port || !name || !DB_CREDENTIALS) {
    throw new Error("DB_HOST, DB_PORT, DB_NAME, and DB_CREDENTIALS are required");
  }

  const { username: masterUser, password: masterPass } = JSON.parse(DB_CREDENTIALS) as {
    username: string;
    password: string;
  };

  const sslmode = process.env.DATABASE_URL?.includes("sslmode=disable") ? "disable" : "require";
  const sql = postgres(
    `postgres://${masterUser}:${encodeURIComponent(masterPass)}@${host}:${port}/${name}?sslmode=${sslmode}`,
    {
      max: 1,
    },
  );

  try {
    console.log(`Setting up Grafana read-only user ${pgIdent(username)}...`);

    await sql.unsafe(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = ${pgLiteral(username)}) THEN
                    CREATE USER ${pgIdent(username)} WITH ENCRYPTED PASSWORD ${pgLiteral(password)};
                ELSE
                    ALTER USER ${pgIdent(username)} WITH ENCRYPTED PASSWORD ${pgLiteral(password)};
                END IF;

                GRANT CONNECT ON DATABASE ${pgIdent(dbName)} TO ${pgIdent(username)};
                GRANT USAGE ON SCHEMA public TO ${pgIdent(username)};
                GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${pgIdent(username)};
                GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO ${pgIdent(username)};
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${pgIdent(username)};
                ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO ${pgIdent(username)};
            END;
            $$;
        `);

    console.log(
      `Grafana user ${pgIdent(username)} is ready with SELECT permissions on all public tables.`,
    );
  } finally {
    await sql.end();
  }
}

// Run standalone: node dist/setup-grafana-user.js
if (require.main === module) {
  setupGrafanaUser()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error("Failed to set up Grafana user:", err);
      process.exit(1);
    });
}
