# @repo/database

Postgres schema, migrations, and seeding for openJII, built on [Drizzle ORM](https://orm.drizzle.team).

Common commands (run from the repo root):

```bash
pnpm db:setup     # start local Postgres (Docker) and run migrations
pnpm db:generate  # generate a migration from schema changes
pnpm db:migrate   # apply migrations
pnpm db:studio    # browse the database with Drizzle Studio
```
