# openJII Backend

The openJII API — a [NestJS](https://nestjs.com) application exposing a contract-first [oRPC](https://orpc.unnoq.com) API consumed by the web and mobile apps.

## Architecture

- **API contract** — endpoints are defined in `@repo/api` (oRPC + Zod) and implemented here with `@orpc/nest`. The OpenAPI spec is generated from the same contract and rendered in the docs site's API reference.
- **Auth** — [Better Auth](https://better-auth.com) via `@repo/auth` (email OTP sign-in, sessions, organizations, API keys, passkeys, optional OAuth providers).
- **Database** — Postgres with Drizzle ORM; schema and migrations live in `@repo/database`.
- **AWS integrations** — IoT Core (device provisioning and MQTT), S3 (uploads and exports), Lambda (macro-sandbox execution), Cognito, and Location.
- **Analytics & email** — PostHog via `@repo/analytics`, transactional email via `@repo/transactional`.

## Development

Run from the repo root:

```bash
pnpm db:setup              # first-time DB setup (destructive: resets local data)
pnpm dev:fb                # backend + web together
# or just this app:
pnpm --filter backend dev
```

### Scripts

```bash
pnpm --filter backend dev          # watch mode
pnpm --filter backend start        # run once
pnpm --filter backend start:prod   # production mode
pnpm --filter backend test         # unit tests
pnpm --filter backend test:watch   # tests in watch mode
```

### Docker

The backend ships as a container; helper scripts are available in this package:

```bash
pnpm --filter backend docker:build
pnpm --filter backend docker:up
pnpm --filter backend docker:logs
pnpm --filter backend docker:down
```

## Documentation

- [API reference](https://docs.openjii.org/api) — generated REST and MQTT documentation
- [Architecture docs](https://docs.openjii.org/developers) — data ingestion, medallion layers, design decisions
