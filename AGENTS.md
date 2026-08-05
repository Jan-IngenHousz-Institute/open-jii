# Agent context

This file is a router, not a snapshot of the repository. Verify architectural claims against the
code because this file cannot guard them.

## Workspace map

| Area              | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `apps/`           | Product applications and documentation                         |
| `packages/`       | Shared contracts, domain code, and components                  |
| `tooling/`        | Repository-wide development and validation tools               |
| `infrastructure/` | Deployment configuration; change only when explicitly in scope |

Read the [mobile domain context](apps/mobile/CONTEXT.md) before changing mobile concepts. Follow
the [web testing guide](apps/web/TESTING.md) for web tests.

## Local workflow

- `pnpm db:setup` starts Postgres, resets the local database, and applies migrations.
- `pnpm --filter database db:seed` seeds local users and development data.
- `pnpm local:login` obtains a local development session without browser automation or email.
- `pnpm dev:fb` starts the web and backend applications.
- `pnpm lint`, `pnpm test`, and `pnpm format:check` are the repository validation commands.

## Repository conventions

- Define API changes contracts-first in `packages/api/`.
- Consumers load the API package from built output, so rebuild workspace packages after contract or
  schema changes. Shared UI is consumed from source and does not require that rebuild.
- Do not add barrel files. Import from the owning module's explicit public path.
- Use conventional commit subjects and keep each commit focused.
- Keep comments rare and explain only constraints that code cannot express.
