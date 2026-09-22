# Agent context

A router, not a snapshot. Commands and paths below are checked; architectural claims are not, so
verify them against the code.

## What lives where

| Path                 | What it is                                                                                                                   | Read first                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web`           | Platform UI. Auth-gated; talks to the backend through the shared contracts.                                                  | `apps/web/README.md`, `apps/web/TESTING.md`                         |
| `apps/backend`       | The API on `:3020`. Boots through a long `getOrThrow` config list.                                                           | `apps/backend/README.md`, `apps/backend/.env.example`               |
| `apps/mobile`        | Field companion. Android is the only published platform — USB serial and Bluetooth Classic rule out iOS for data collection. | `apps/mobile/CONTEXT.md` (domain glossary), `apps/mobile/README.md` |
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
the devkit (`tooling/devkit/README.md`: the local commands that need a credential).
`infrastructure/` is OpenTofu — change it only when that is explicitly the task.

## Running things locally

The platform UI is auth-gated, so a real check needs Postgres and the backend, not just the web app.

- After the user authorizes resetting local data, run `pnpm db:setup` to start Postgres,
  **reset** the local database, and apply migrations.
- `pnpm --filter database db:seed` — seeds the local user and development data.
- `pnpm local:login` — signs in the seed user with no browser and no email (it reads the OTP from
  Postgres) and writes the session to `.claude/session.header` for
  `curl -H @.claude/session.header`; the cookie never prints unless you pass `--print`.
- `pnpm dev:fb` — runs backend and web together.
- `pnpm e2e` — the browser end-to-end suite, against an already-running stack.
- `pnpm lint`, `pnpm test`, `pnpm format:check` — validation.
- `pnpm linear:auth` stores your Linear key in the owner-only `tooling/devkit/.env`;
  `pnpm linear:query` and the other `linear:*` commands read it in process, so the key never enters
  a shell. `tooling/devkit/README.md` has the one-time setup a person follows.

Copy `apps/backend/.env.example` to `apps/backend/.env` before first boot. It is generated and
boot-tested, and its comments mark the variables where a plausible dummy value is **worse** than
leaving the variable unset.

**Expect these to be dead locally**: anything reading the lakehouse (data tables, exports,
annotations), CMS-backed public pages, and every AWS-backed feature. The example env points them at
unreachable endpoints deliberately. Assert on page chrome, not on that data.

## Skills

Task guides live in `.agents/skills/<name>/SKILL.md`. They are plain markdown and tool-agnostic:
read the file when the situation matches. `.claude/skills/` holds symlinks to the same files so
Claude Code auto-discovers them, but the files under `.agents/` are the source. The symlink layer
assumes the team's supported macOS/Linux development environments. The shared hooks require Bash,
Git, and `jq`; a missing `jq` prints a warning and skips the hook.

| Skill                      | Read it when                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `openjii-local-stack`      | Preparing a local checkout, seeding, or getting a dev session cookie.                                        |
| `openjii-mobile-device`    | Getting a dev build onto a real Android phone, over cable or Wi-Fi.                                          |
| `openjii-mobile-control`   | Driving a connected phone to verify or reproduce mobile behaviour.                                           |
| `openjii-docs-update`      | A change alters what a user sees or does, so docs and screenshots follow.                                    |
| `openjii-prepare-release`  | Preparing or rehearsing a release, CMS notes, a mobile gate, or a Linear update.                             |
| `openjii-linear`           | Anything touching an `OJD-####` ticket, the backlog, or project status.                                      |
| `openjii-work-design`      | An idea needs designing as a project and splitting into tickets.                                             |
| `openjii-ticket-refine`    | One ticket needs writing, or bringing up to the ticket gate.                                                 |
| `openjii-testing-criteria` | A PR is ready for review and the ticket needs its handoff sections for QA.                                   |
| `openjii-backlog-triage`   | Bulk label, project or gate hygiene across many tickets.                                                     |
| `openjii-daily`            | Once a day, or coming back after time away, and you need to know whether the platform needs a person.        |
| `openjii-triage`           | A digest line, a Grafana alert or a runbook points at a metric id and you need evidence rather than a guess. |
| `unslop`                   | Writing or editing prose a human will read: docs, PR bodies, changelogs.                                     |

`unslop` comes from a third party rather than from this repo, so it does not open with
`Read AGENTS.md first` like the `openjii-*` guides do. It carries no repo-specific paths and needs
none. See `.agents/skills/ATTRIBUTION.md` for its licence and upstream commit.

## Working on mobile

`pnpm --filter mobile adb:reverse` is what lets a USB-cabled phone reach Metro and the local
backend. See the `openjii-mobile-device` skill for getting a build onto a phone, and
`openjii-mobile-control` for driving and testing one.

## Docs follow the feature

If a change alters what a user sees or does, `apps/docs/content` changes in the same PR, and any
screenshot showing the affected screen is re-captured rather than reused. The
`openjii-docs-update` skill covers where things live and the privacy rules on captures.

A `Stop` hook in `.claude/settings.json` gives Claude Code one reminder per session when `apps/web`
or `apps/mobile` change without `apps/docs/content`. It is a nudge, not a gate, and it only reaches
Claude Code. Per-machine overrides belong in `.claude/settings.local.json`, which stays untracked.

## main is protected

A `PreToolUse` hook is a local seatbelt alongside the authoritative remote branch protection: it
blocks destructive git while you are on `main`, and blocks pushing to `main` from anywhere. Work
on a branch and open a PR. On your own branches nothing is restricted: force-push, reset and clean
as you like.

## Pull requests feed releases

Before opening or updating a PR, follow
[Pull request and release metadata](CONTRIBUTING.md#pull-request-and-release-metadata). That section
is the source of truth for PR titles, Linear issue relations, and exemptions.

A PR is ready for review only when its proposed title and body satisfy that contract and the
`Linear ref check` can pass. When handing work back without opening the PR, provide the exact title
and Linear relation lines the author should use.

## Agent skills

Configuration the vendored `mattpocock/skills` guides read. These files answer "where do issues
live" and "what should I read before exploring", so those skills do not have to guess.

### Issue tracker

Issues live in Linear (team `OJD`); GitHub Issues is a synced mirror. Projects are the unit of
design and tickets are granular work under a project. `Done` means live on production. See
`docs/agents/issue-tracker.md` for access, `docs/agents/ticket-standard.md` for the project and
ticket shapes, the gates and the prose bar, and `docs/agents/linear-taxonomy.md` for the labels. The
team runs no cycles and no estimation.

### Triage labels

The five canonical role names, used verbatim as Linear labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md`, which points at the public glossary, plus the ADRs under
`apps/docs/content/developers/design-decisions/`. `/domain-modeling` extends them when a term or
decision actually needs recording. See `docs/agents/domain.md`.

## Conventions

- Define API changes contracts-first in `packages/api`, then implement both sides against them.
- `@repo/api` and `@repo/analytics` are consumed from build output, so rebuild workspace packages
  after changing them. Analytics types point at `src/` while runtime code points at `dist/`, so the
  IDE can look current while the running code is stale. `@repo/ui` is consumed from source and needs
  no rebuild.
- No barrel files. Import from the owning module's explicit path.
- Conventional commit subjects; keep each commit focused.
- Comments are rare here. Explain constraints the code cannot express, nothing else.
