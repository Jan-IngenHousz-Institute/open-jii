# Database

`packages/database`, which owns the Postgres schema, the migrations, the seed scripts and the local
database lifecycle. Every app that reads Postgres imports the schema and the drizzle operators from
here.

How the backend queries it is [backend.md](backend.md). What the API exposes is [api.md](api.md),
and the two are deliberately not the same shape.

## Read first

- `packages/database/src/schema.ts`, in particular the comment blocks above the custom types, which
  record constraints the code cannot express.
- `packages/database/drizzle/_journal.json` for the migration order.

## Shape

```text
src/schema.ts            every table and enum, 33 tables and 16 enums today
src/database.ts          the client
src/index.ts             re-exports the schema plus drizzle's operators
src/migrate.ts           the migration runner
src/organizations.ts     ensurePersonalOrganization
src/resource-grants.ts   upsertGrant, deleteResourceGrants
drizzle/NNNN_name.sql    50 migrations, applied in journal order
drizzle/meta/            one snapshot per migration, plus _journal.json
scripts/                 seed, seed-organizations, reset
```

The apps import `eq`, `and`, `sql` and `alias` from `@repo/database` rather than from drizzle
directly, which is why `src/index.ts` re-exports them.

## Rules

1. A table is `pgTable("snake_case_name", { ... })` with camelCase TypeScript keys, and its
   constraints go in the second callback argument as `primaryKey`, `unique`, `uniqueIndex`, `index`
   or `check`. A closed vocabulary is a `pgEnum`, not a text column with a comment. [review]
2. Spread the `timestamps` helper instead of declaring `created_at` and `updated_at` by hand. It
   defaults both to `(now() AT TIME ZONE 'UTC')` and gives `updatedAt` an `$onUpdate`, so every
   table in the repo stores UTC and refreshes the same way. [review]
3. Use `postgresJsJsonb` for a column that stores a JSON string document, such as macro code, and
   drizzle's built-in `jsonb` for objects and arrays. The custom type exists because the built-in
   parses a string driver value a second time, which turns a stored `"[1,2]"` into an array. Today
   that applies to exactly one column and the distinction is easy to get wrong, so read the comment
   above the type before adding a `jsonb` column. [review]
4. Generate every migration with `pnpm db:generate` and give it a descriptive name, so the
   directory reads as a history rather than as drizzle's random word pairs. [review]
5. Never hand-edit a file under `drizzle/meta/`. If you do have to write SQL by hand, because
   drizzle-kit cannot express it, the change still ships with a regenerated snapshot. A
   hand-written migration without its snapshot makes the next `db:generate` emit churn that has
   nothing to do with the change someone is making. [review]
6. Full-text search is split on purpose. The `tsvector` column is declared in the schema, but its
   `GENERATED ALWAYS` expression and the GIN and pg_trgm indexes live in the migration SQL, because
   drizzle-kit cannot serialise the helper functions and operator classes they use. The `'english'`
   configuration has to match `FTS_CONFIG` in the backend, which builds the query side, and the
   column is stripped from API responses rather than exposed. [review]
7. One schema change is one migration, and a merged migration is never edited. Someone else has
   already run it. [review]
8. Anything that touches a database runs through the env-scoped scripts, `env:default` for
   development and `env:test` for the suite, so the test database on its own port is never confused
   with the development one. [review]

## Patterns

**Changing the schema.** Edit `src/schema.ts`, run `pnpm db:generate --name something-descriptive`,
read the generated SQL before you trust it, then apply it. Check that the diff contains both the
SQL file and its snapshot, and nothing else; unrelated churn in the snapshot means someone
previously hand-edited one.

**Something drizzle-kit cannot express.** Generate the migration anyway, then append the raw SQL to
the generated file and regenerate the snapshot so the two agree. The search migrations are the
worked example.

**Resetting local data.** `pnpm db:setup` starts Postgres, resets the database and applies
migrations, which destroys local data, so it needs the developer to say yes first. The backend
suite drives the `db:test:*` equivalents against a separate compose project.

## Tests

This package has none, and no vitest configuration. What exercises the schema is the backend suite,
which runs against a real Postgres brought up by `db:test:setup`, so a bad migration surfaces there
rather than here.

## Known debt

`src/schema.ts` is 923 lines holding every domain's tables in one module. Splitting it per domain
would help navigation, but every consumer imports from `@repo/database` and the drizzle-kit
configuration points at this one file, so the split is a real change rather than a file move. No
ticket.

The package declares neither `check-types` nor a test script, so nothing in CI type-checks it
directly and it is only ever checked through the apps that import it. Adding `check-types` is
cheap. Needs a ticket.

`db:migrate` in `turbo.json` is `cache: false` but declares no `dependsOn`, so it does not wait for
`^build`. It works today because the script runs through tsx rather than the built output. No
ticket.

Nothing mechanically enforces rule 5. The failure mode is quiet and someone hits it months later,
so a CI check that regenerates and diffs would pay for itself. Needs a ticket.

## Decisions

- 2026-09-21. Rule 5 is written down here for the first time. It came out of a real incident where a
  hand-written migration shipped without its snapshot and the next generate produced unrelated enum
  churn.
- 2026-09-21. `src/index.ts` re-exporting drizzle's operators stays, even though
  [code.md](code.md) rule 8 is unkind to re-export surfaces. Every app already imports `eq` and
  `and` from here, and the alternative is each app depending on drizzle directly and drifting on
  version.
