# Agent context

A router, not a snapshot. Commands and paths below are checked; architectural claims are not, so
verify them against the code.

## What lives where

| Path                 | What it is                                                                                                                   | Read first                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web`           | Platform UI. Auth-gated; talks to the backend through the shared contracts.                                                  | `apps/web/README.md`, `apps/web/TESTING.md`                         |
| `apps/backend`       | The API on `:3020`. Boots through a long `getOrThrow` config list.                                                           | `apps/backend/README.md`, `apps/backend/.env.example`               |
| `apps/mobile`        | Field companion. Android is the only published platform — USB serial and Bluetooth Classic rule out iOS for data collection. | `apps/mobile/CONTEXT.md` (domain glossary), `apps/mobile/README.md` |
| `apps/e2e`           | Browser tests driving the real running stack.                                                                                | `apps/e2e/README.md`                                                |
| `apps/data`          | Databricks pipelines and notebooks. Separate Python toolchain, outside the pnpm dev loop.                                    | `apps/data/README.md`                                               |
| `apps/macro-sandbox` | Sandboxed runtimes that execute user-authored macros.                                                                        | `apps/macro-sandbox/README.md`                                      |
| `apps/docs`          | The public documentation site.                                                                                               | `apps/docs/README.md`                                               |
| `apps/tools`         | Standalone device utilities, e.g. the MultispeQ MQTT interface.                                                              | `apps/tools/multispeq_mqtt_interface/README.md`                     |

| Package                                                           | Owns                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/api`                                                    | The contract layer. API shapes live here; both sides import them.   |
| `packages/auth`                                                   | Sessions, email OTP, OAuth, passkeys, API keys.                     |
| `packages/database`                                               | Schema, migrations, seed script.                                    |
| `packages/iot`                                                    | Device connectivity and payload handling.                           |
| `packages/ui`                                                     | Shared components, consumed from source.                            |
| `packages/cms`                                                    | Contentful client and generated types.                              |
| `packages/i18n` · `packages/analytics` · `packages/transactional` | Translations · logging and product analytics · transactional email. |

`tooling/*` holds shared eslint, tailwind, tsconfig and vitest config, plus release scripting and
the devkit. `infrastructure/` is OpenTofu — change it only when that is explicitly the task.

## Running things locally

The platform UI is auth-gated, so a real check needs Postgres and the backend, not just the web app.

- `pnpm db:setup` — starts Postgres, **resets** the local database, applies migrations.
- `pnpm --filter database db:seed` — seeds the local user and development data.
- `pnpm local:login` — a session cookie with no browser and no email; reads the OTP from Postgres.
- `pnpm dev:fb` — runs backend and web together.
- `pnpm lint`, `pnpm test`, `pnpm format:check` — validation.

Copy `apps/backend/.env.example` to `apps/backend/.env` before first boot. It is generated and
boot-tested, and its comments mark the variables where a plausible dummy value is **worse** than
leaving the variable unset.

**Expect these to be dead locally**: anything reading the lakehouse (data tables, exports,
annotations), CMS-backed public pages, and every AWS-backed feature. The example env points them at
unreachable endpoints deliberately. Assert on page chrome, not on that data.

## Working on mobile

`pnpm --filter mobile adb:reverse` is what lets a USB-cabled phone reach Metro and the local
backend. See the `openjii-mobile-device` skill for getting a build onto a phone, and
`openjii-mobile-control` for driving and testing one.

## Docs follow the feature

If a change alters what a user sees or does, `apps/docs/content` changes in the same PR, and any
screenshot showing the affected screen is re-captured rather than reused. The
`openjii-docs-update` skill covers where things live and the privacy rules on captures.

A `Stop` hook in `.claude/settings.json` prints a reminder when `apps/web` or `apps/mobile` change
without `apps/docs/content`. It is a nudge, not a gate, and it only reaches Claude Code. Per-machine
overrides belong in `.claude/settings.local.json`, which stays untracked.

## Conventions

- Define API changes contracts-first in `packages/api`, then implement both sides against them.
- `@repo/api` is consumed from build output, so rebuild workspace packages after contract or schema
  changes. `@repo/ui` is consumed from source and needs no rebuild.
- No barrel files. Import from the owning module's explicit path.
- Conventional commit subjects; keep each commit focused.
- Comments are rare here. Explain constraints the code cannot express, nothing else.
