# @repo/database

The schemas, migrations and clients of openJII's two databases:

- **Postgres** holds the application's data. Schema, client and seeding are built on
  [Drizzle ORM](https://orm.drizzle.team). Code in `src/postgres`, migrations in
  `postgres/migrations`. The package's root export is this client and schema.
- **ClickHouse** is the serving store the app reads measurement data from, fed by the data
  pipelines. Migrations in `clickhouse/migrations`, applied with
  [clickhouse-migrations](https://github.com/VVVi/clickhouse-migrations).

`src/migrate.ts` is the migration runner the deploy runs as a one-off ECS task. It checks that
ClickHouse is configured, that its migrations are numbered as the runner expects, and that it
answers to the runner's credentials, then migrates ClickHouse, then Postgres, so a failed store
migration leaves Postgres as it was. An environment without a serving store, such as DR, leaves
`CLICKHOUSE_URL` unset and migrates Postgres only. While the store is down, the Database
Migrations workflow's `skip_store_migrations` input migrates Postgres alone
(`docs/runbooks/store-answers.md`).

Common commands (run from the repo root):

```bash
pnpm db:setup     # first-time setup: start Postgres (Docker), RESET the schema, migrate
pnpm db:generate  # generate a Postgres migration from schema changes
pnpm db:migrate   # apply Postgres migrations
pnpm db:studio    # browse Postgres with Drizzle Studio
```

## ClickHouse migrations

Each file in `clickhouse/migrations` runs once, into the `store` database, recorded in its
`_migrations` table with a checksum. The runner refuses to continue when a recorded file changed or
disappeared, so:

- Name files `NNNN_description.sql`, starting at `0001`, one number per file. The runner refuses
  `0000` and names without a number, and its version column cannot hold a timestamp, so the
  migrate task checks names before it changes anything.
- Never edit or delete a file once it has run anywhere. Change the schema with a new file.
- Statements in a file run one at a time, with no transaction. Write them so a rerun after a
  failure is harmless (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), or keep one
  statement per file.
- A statement gets eight minutes. Longer work, such as a large backfill, belongs in a runbook.
