# AGENTS.md

Guidance for AI coding agents (and new contributors) working in the openJII monorepo.
Human-facing contribution rules live in [CONTRIBUTING.md](./CONTRIBUTING.md); this file is
the fast, practical "how do I build/run/test this" reference.

## Stack & layout

Turborepo + pnpm workspaces. **Node ≥ 22**, **pnpm 10.7.1** (`packageManager` is pinned —
use `corepack`/the pinned version, don't `npm`/`yarn`).

- `apps/web` — Next.js 16 platform UI (App Router, `@/` → `apps/web`, `~/` → `apps/web`).
- `apps/backend` — NestJS API (ts-rest contracts), serves on **:3020**.
- `apps/mobile` — Expo / React Native.
- `apps/docs` — Docusaurus (the public changelog lives here).
- `packages/*` — shared libs: `api` (ts-rest contract + zod schemas, consumed from **dist**),
  `ui` (shadcn/Radix components, consumed from **src** via `transpilePackages`),
  `auth` (better-auth), `database` (Drizzle + migrations + seed), `i18n`, `analytics`,
  `cms` (Contentful), `iot`, `transactional`.
- `tooling/*` — shared eslint / tailwind / tsconfig / vitest config.

## Everyday commands (from repo root)

```bash
pnpm install                  # install workspace deps
pnpm dev                      # turbo dev (everything)
pnpm dev:fb                   # just backend + web
pnpm build                    # turbo build (all)
pnpm build:packages           # build shared packages only (needed before running apps fresh)
pnpm lint                     # turbo lint
pnpm typecheck                # turbo typecheck
pnpm test                     # turbo test (vitest across workspaces)
pnpm format:check             # prettier check
```

Scope to one workspace with `--filter`, e.g. `pnpm --filter web exec vitest run`,
`pnpm --filter web check-types`, `pnpm --filter web lint`. Prettier line width is 100;
run `pnpm format` (or `prettier --write`) before committing — CI checks formatting.

## Conventions worth knowing

- **Web/mobile are DDD-lite**: code is split into `features/` + `shared/` with an ESLint
  **boundary lint** (no cross-feature imports, no deep `shared` reaches). Respect existing
  module edges; don't add barrels (`index.ts` re-export files are banned by lint).
- **Contracts first**: API shapes live in `packages/api` (ts-rest + zod). The backend and the
  web client both import from there — change the contract, not ad-hoc fetch types.
- **`@repo/api` is consumed from `dist`** — rebuild it (`pnpm build:packages`) after editing
  schemas/contracts or the web typecheck/runtime will see stale types. `@repo/ui` is consumed
  from source, so UI edits need no rebuild.
- Tests are **vitest** (+ Testing Library for web/ui). Co-locate as `*.test.ts(x)`.
- Commit style is conventional commits (`feat(web): …`, `fix(web, ui): …`).

## Running the full stack locally (for manual / E2E testing)

The platform UI is gated behind email-OTP auth, so you need Postgres + the backend, not just
`next dev`. There is a turnkey, documented harness under **[`apps/web/e2e/`](./apps/web/e2e/)** —
read its [README](./apps/web/e2e/README.md). The short version:

1. **Infra** (Docker is podman-emulated; use plain `podman run`/`start`, not compose):
   Postgres 15 on `5432` (db `openjii_local`, `postgres`/`postgres`) and any SMTP sink
   (e.g. mailcatcher/mailpit) on `1025`.
2. **Env**: copy working `apps/{backend,web}/.env` (they point the web client at the backend on
   `:3020` and set `AUTH_EMAIL_SERVER=smtp://localhost:1025`). The backend boots via
   `getOrThrow` on a long list of AWS/Databricks/Contentful keys — fill any missing ones with
   dummy values; the two `DATABRICKS_*_JOB_ID`s must be **numeric** and `AWS_IOT_POLICY_NAMES`
   must be non-empty. One-liner: `apps/web/e2e/README.md` has the exact loop.
3. **DB**: `pnpm db:migrate` then seed (`pnpm --filter database db:seed`). Seeds user
   **`seed@openjii.local`** and 5 experiments. Auth is OTP-only and **the OTP is stored in
   plaintext** in the `verifications` table — read it from Postgres instead of a mailbox.
4. **Run**: `pnpm --filter backend dev` (:3020) and `pnpm --filter web dev` (:3000).

> **Local limitation:** Databricks creds in the dev `.env` are expired, so anything that reads
> the lakehouse (experiment **data tables**, exports, annotations) returns 401/500 locally. The
> page *chrome* still renders — only the data payload is blocked.

## End-to-end / UI smoke tests

`apps/web/e2e/` holds Python Playwright scripts that drive the **real** browser against the
running stack (typed login via OTP-from-Postgres, no value injection):

```bash
# stack already up per the steps above
cd apps/web/e2e && python3 smoke_chrome_refresh.py   # screenshots -> /tmp/e2e-chrome-refresh
```

`helpers.py` exposes a reusable `login(page)` (and `seed_experiment_id()`); write new specs
against it. See [`apps/web/e2e/README.md`](./apps/web/e2e/README.md) for setup and env overrides.
