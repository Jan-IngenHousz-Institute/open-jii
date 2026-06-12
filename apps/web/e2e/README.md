# Web E2E (Playwright)

Browser-driven smoke tests for the platform UI. They drive the **real** app against a running
local stack — typing into the real login form and reading the OTP from Postgres — so they catch
hydration errors, broken navigation, and runtime crashes that unit tests can't.

> These are intentionally framework-light **Python Playwright** scripts (no extra workspace
> dependency, no `@playwright/test` lockfile churn). The browser is the one Playwright already
> ships. Port them to `@playwright/test` later if the team wants CI integration.

## Prerequisites

- Python 3 with Playwright + Chromium:
  ```bash
  pip install playwright && playwright install chromium
  ```
- `podman` (or `docker`) for Postgres, and the local stack running (below).

## 1. Bring up the stack

Docker is podman-emulated here, so use plain `podman` (compose needs a socket that's usually
off). You need Postgres and an SMTP sink.

```bash
# Postgres 15 on :5432 (db openjii_local, postgres/postgres) + an SMTP catcher on :1025
podman start database-postgres-1 transactional-mailcatcher-1    # if they already exist, else:
podman run -d --name database-postgres-1 -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=openjii_local postgres:15
podman run -d --name mailcatcher -p 1025:1025 -p 1080:1080 dockage/mailcatcher:0.9.0
```

Env files (copy your working dev ones into the worktree):

```bash
cp /path/to/main-checkout/apps/backend/.env apps/backend/.env
cp /path/to/main-checkout/apps/web/.env     apps/web/.env
```

The backend boots with `getOrThrow` over a long config list. Fill any missing keys with dummy
values, then fix the typed ones:

```bash
cd apps/backend
for v in $(grep -rhoE "process\.env\.[A-Z0-9_]+" src/common/config/ | sed 's/process.env.//' | sort -u); do
  grep -q "^$v=" .env || echo "$v=dummy-local" >> .env
done
sed -i 's|^DATABRICKS_DATA_EXPORT_JOB_ID=.*|DATABRICKS_DATA_EXPORT_JOB_ID=1|' .env
sed -i 's|^DATABRICKS_DATA_UPLOAD_JOB_ID=.*|DATABRICKS_DATA_UPLOAD_JOB_ID=2|' .env   # job IDs must be numeric
# AWS_IOT_POLICY_NAMES must be non-empty too
cd -
```

Build shared packages, migrate + seed, then start the apps:

```bash
pnpm build:packages
pnpm db:migrate
pnpm --filter database db:seed        # creates seed@openjii.local + 5 experiments
pnpm --filter backend dev             # :3020
pnpm --filter web dev                 # :3000
```

## 2. Run the tests

```bash
cd apps/web/e2e
python3 smoke_chrome_refresh.py       # screenshots -> /tmp/e2e-chrome-refresh
```

Exit code is non-zero if any check fails **or** the page logs an unexpected runtime error
(expected Databricks/Contentful 404/500 noise is filtered out).

## How auth works (the important bit)

Login is **email-OTP only** (better-auth) — there is no password. The OTP is written to Postgres
in plaintext (`verifications.identifier = 'sign-in-otp-<email>'`, `value = '<otp>:<attempts>'`),
so the harness sends the code through the real UI, then reads it straight from the DB instead of
scraping a mailbox. The `input-otp` field auto-submits on the 6th digit. See `helpers.login()`.

## Files & reuse

| File | Purpose |
| --- | --- |
| `helpers.py` | `login(page)`, `wait_for_fresh_otp()`, `seed_experiment_id()`, cookie banner dismissal. Build new specs on top of these. |
| `smoke_chrome_refresh.py` | Chrome-refresh (OJD-1510) smoke: sidebar, command palette, shortcuts, breadcrumbs, activity bell, settings tabs, page container. |

Override defaults via env: `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PG_CONTAINER`, `E2E_PG_DB`, `E2E_OUT`.

## Known local limitation

The dev `.env` Databricks creds are expired, so the experiment **data table** can't load locally
(401 → "Failed to retrieve table metadata"). The page chrome still renders; the smoke test only
asserts the chrome, not the lakehouse payload.
