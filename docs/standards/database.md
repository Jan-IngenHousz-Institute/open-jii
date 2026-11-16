# Database

`packages/database`, which owns the Postgres schema and migrations, the serving store migrations in
ClickHouse, the seed scripts and the local database lifecycle. The backend and `packages/auth`
import the Postgres schema and the drizzle operators from here.

How the backend queries it is [backend.md](backend.md). What the API exposes is [api.md](api.md),
and the two are deliberately not the same shape.

## Read first

- `packages/database/src/postgres/schema.ts`, in particular the comment blocks above the custom
  types, which record constraints the code cannot express.
- `packages/database/README.md` for the two stores and the migration runner.
- `packages/database/postgres/migrations/meta/_journal.json` for the Postgres migration order.

## Shape

```text
src/postgres/schema.ts           every Postgres table and enum, 44 tables and 27 enums today
src/postgres/database.ts         the client, the transaction types, createSecondaryDatabase
src/postgres/index.ts            re-exports the schema, client, helpers and drizzle's operators
src/postgres/migrate.ts          the Postgres migration runner
src/postgres/organizations.ts    ensurePersonalOrganization and the personal organization helpers
src/postgres/resource-grants.ts  upsertGrant, deleteResourceGrants and the other grant helpers
src/clickhouse/migrate.ts        the serving store migration runner and its pre-flight checks
src/migrate.ts                   runs ClickHouse first, then Postgres, as the deploy task
postgres/migrations/             66 migrations in journal order, with meta/ holding the snapshots
clickhouse/migrations/           7 serving store migrations, NNNN_name.sql from 0001
scripts/                         seed, seed-organizations, reset, and seed/ with the table seeds
```

The backend and `packages/auth` import `eq`, `and`, `sql` and `alias` from `@repo/database` rather
than from drizzle directly, which is why `src/postgres/index.ts` re-exports them.

## Rules

1. A table is `pgTable("snake_case_name", { ... })` with camelCase TypeScript keys, and its
   constraints go in the second callback argument as `primaryKey`, `unique`, `uniqueIndex`, `index`
   or `check`. A closed vocabulary is a `pgEnum`, not a text column with a comment. The exception
   is a column whose values come from a registry in `packages/api`, such as a notification type,
   which is text in the schema and validated at the contract, so adding a value needs no migration.
   [review]
2. Spread the `timestamps` helper instead of declaring `created_at` and `updated_at` by hand. It
   defaults both to `(now() AT TIME ZONE 'UTC')` and gives `updatedAt` an `$onUpdate`. A table that
   is only ever inserted into, such as a visit or an audit entry, declares its one event time with
   the same UTC default, so every timestamp is stored in UTC. [review]
3. Use `postgresJsJsonb` for a column that stores a JSON string document, such as macro code, and
   drizzle's built-in `jsonb` for objects and arrays. The custom type exists because the built-in
   parses a string driver value a second time, which turns a stored `"[1,2]"` into an array. Today
   that applies to three columns, the protocol code, an export's parts and an upload's rejected
   files, and the distinction is easy to get wrong, so read the comment above the type before
   adding a `jsonb` column. [review]
4. Generate every migration with `pnpm db:generate` and give it a descriptive name, so the
   directory reads as a history rather than as drizzle's random word pairs. [review]
5. Never hand-edit a file under `postgres/migrations/meta/`. If you do have to write SQL by hand,
   because drizzle-kit cannot express it, the change still ships with a regenerated snapshot. A
   hand-written migration without its snapshot makes the next `db:generate` emit churn that has
   nothing to do with the change someone is making. [review]
6. Full-text search is split on purpose. The `tsvector` column and its `generatedAlwaysAs`
   expression are declared in the schema, and the expression is repeated in the migration SQL. The
   GIN and pg_trgm indexes live only in the migration SQL, because drizzle-kit cannot serialise the
   operator classes they use. The `'english'` configuration has to match `FTS_CONFIG` in the
   backend, which builds the query side, and the column is stripped from API responses rather than
   exposed. [review]
7. One schema change is one migration, and a merged migration is never edited. Someone else has
   already run it. [review]
8. Anything that touches a database runs through the env-scoped scripts, `env:default` for
   development and `env:test` for the suite, so the test database on its own port is never confused
   with the development one. [review]
9. A serving store migration is `clickhouse/migrations/NNNN_description.sql`, numbered from 0001
   with one number per file. Never edit or delete one that has run anywhere, because the runner
   refuses to continue when a recorded file changed. Each statement runs on its own without a
   transaction, so write it to be safe to rerun, or keep one statement per file. A statement gets
   eight minutes, so a large backfill belongs in a runbook. [review]
10. A change to a store table travels with the feed that writes it, in
    `apps/data/src/lib/openjii/openjii/serving_store`, and the backend read that serves it, in
    `apps/backend/src/common/modules/serving-store`, because all three depend on the migration
    file. [review]
11. Functions, triggers and grants cannot be expressed in the schema, so they live only in a
    hand-written migration, and the schema carries a comment naming it. Do not run `db:push`
    against a database that needs them. [review]
12. A table or column that a platform metric counts needs a migration that grants `SELECT` on
    exactly those columns to `metrics_publisher`. A new table is closed to that role by default, so
    a permission error in the publisher after a release usually means the grant is missing.
    `docs/runbooks/metrics-publisher-errors.md` covers it. [review]

## Patterns

**Changing the schema.** Edit `src/postgres/schema.ts`, run
`pnpm db:generate --name something-descriptive`, read the generated SQL before you trust it, then
apply it. Check that the diff contains both the SQL file and its snapshot, and nothing else;
unrelated churn in the snapshot means someone previously hand-edited one.

**Something drizzle-kit cannot express.** Generate the migration anyway, then append the raw SQL to
the generated file and regenerate the snapshot so the two agree. Migration 0048 is the worked
example for a search column, and 0065 is the worked example for a function and its triggers, which
the schema cannot declare at all.

**Resetting local data.** `pnpm db:setup` starts Postgres, resets the database and applies
migrations, which destroys local data, so it needs the developer to say yes first. The backend
suite drives the `db:test:*` equivalents against a separate compose project.

## Tests

This package has none, and no vitest configuration. What exercises the schema is the backend suite,
which runs against a real Postgres brought up by `db:test:setup`, so a bad migration surfaces there
rather than here.

## Known debt

`src/postgres/schema.ts` is 1,362 lines holding every domain's tables in one module. Splitting it
per domain would help navigation, but every consumer imports from `@repo/database` and the
drizzle-kit configuration points at this one file, so the split is a real change rather than a file
move. No ticket.

The package declares a `check-types` script but no test script, so nothing exercises the schema
directly. The backend suite runs against it. No ticket.

`db:migrate`, `db:generate` and `db:setup` in `turbo.json` are `cache: false` but declare no
`dependsOn`, so they do not wait for `^build`. It works today because `drizzle-kit` reads the
config and the SQL files and not the built output. No ticket.

Nothing mechanically enforces rule 5. The failure mode is quiet and someone hits it months later,
so a CI check that regenerates and diffs would pay for itself. Needs a ticket.

`postgres/migrations/0050_quick_lucky_pierre.sql` and `0065_cynical_zuras.sql` have generated names
against rule 4. Rule 7 forbids editing a merged migration, so leave them. No ticket.

The comment above `tsvector` in `src/postgres/schema.ts` still says the generated expression lives
only in the migrations, against rule 6. Correct it the next time the file is open. No ticket.

`src/postgres/database.ts` casts the database credentials it reads, and
`src/postgres/resource-grants.ts` casts a role tuple, against rule 1 of [code.md](code.md).
`src/postgres/index.ts` has five `export *` statements, against rule 8, and the decision below
accepts only the drizzle operators. Fix the casts the next time either file is open. No ticket.

## Decisions

- 2026-09-21. Rule 5 is written down here for the first time. It came out of a real incident where a
  hand-written migration shipped without its snapshot and the next generate produced unrelated enum
  churn.
- 2026-09-21. `src/postgres/index.ts` re-exporting drizzle's operators stays, even though
  [code.md](code.md) rule 8 is unkind to re-export surfaces. Every consumer already imports `eq` and
  `and` from here, and the alternative is each one depending on drizzle directly and drifting on
  version.
- 2026-11-16. Reconciled with main, so the paths, the counts, the rules and the debt lines now
  cover the serving store migrations and follow the code as it stands.
