---
name: openjii-local-stack
description: Prepare or authenticate to an openJII local checkout.
---

# OpenJII local stack

Read `AGENTS.md` first.

1. Run `pnpm db:setup` to start Postgres, reset the local database, and apply migrations.
2. Run `pnpm --filter database db:seed` to seed local users and data.
3. Run `pnpm dev:fb` to start the backend and web applications.
4. Run `pnpm local:login` when a session cookie is needed.

Do not run database setup unless the user has authorized resetting local data.
