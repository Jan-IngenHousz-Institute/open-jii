# Web E2E

The Playwright suite drives the real web and backend applications. It types through the email-OTP
login flow, reads the OTP from the local Postgres database, and exercises browser behavior that
unit tests cannot cover reliably: hydration, navigation, keyboard shortcuts, and runtime errors.

## Run locally

Prepare and start the local stack:

```sh
pnpm db:setup
pnpm --filter database db:seed
pnpm dev:fb
```

In another terminal, wait for both applications and run the suite:

```sh
until curl -fsS http://127.0.0.1:3020/health >/dev/null && \
  curl -fsS http://127.0.0.1:3000 >/dev/null; do sleep 1; done
pnpm --filter @repo/e2e exec playwright install chromium
pnpm e2e
```

The default web URL is `http://localhost:3000`, the seed identity is `seed@openjii.local`, and the
database is `postgresql://postgres:postgres@127.0.0.1:5432/openjii_local`. Override them with
`E2E_BASE_URL`, `E2E_EMAIL`, and `E2E_DATABASE_URL` when needed. Authentication state is recreated
under `.auth` for every run.

The manual Web E2E workflow does not run on pull requests. It intentionally uses a production build
and its standalone server while local development uses `next dev`; removing per-route compilation
makes Playwright timing deterministic in CI.

## Tests and artifacts

- `specs/chrome-refresh.spec.ts` covers the authenticated application shell and experiment chrome.
- `specs/workbook-search.spec.ts` covers server-side workbook search and attachment.
- `scripts/record-maintenance.ts` records maintenance-mode screenshots and video but is not a test.

HTML reports are written below `playwright-report`. Failed runs retain screenshots and videos below
`test-results`, and CI retries capture traces there; both directories are ignored by Git.
