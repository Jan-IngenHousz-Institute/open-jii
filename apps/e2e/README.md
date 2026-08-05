# Web E2E

The Playwright suite drives the real web and backend applications. It types through the email-OTP
login flow, reads the OTP from the local Postgres database, and exercises browser behavior that
unit tests cannot cover reliably: hydration, navigation, keyboard shortcuts, and runtime errors.

## Run locally

Use Node 24 or newer, then prepare and start the local stack:

```sh
pnpm local:setup
pnpm dev:fb
```

In another terminal, wait for both applications and run the suite:

```sh
pnpm local:doctor --wait
pnpm --filter @repo/e2e exec playwright install chromium
pnpm e2e
```

The default web URL is `http://localhost:3000`, the seed identity is `seed@openjii.local`, and the
database is `postgresql://postgres:postgres@127.0.0.1:5432/openjii_local`. Override them with
`E2E_BASE_URL`, `E2E_EMAIL`, and `E2E_DATABASE_URL` when needed. Authentication state is recreated
under `.auth/` for every run.

CI intentionally uses a production build and its standalone server while local development uses
`next dev`; removing per-route compilation makes Playwright timing deterministic in CI.

## Tests and artifacts

- `specs/chrome-refresh.spec.ts` covers the authenticated application shell and experiment chrome.
- `specs/workbook-search.spec.ts` covers server-side workbook search and attachment.
- `scripts/record-maintenance.ts` records maintenance-mode screenshots and video but is not a test.

HTML reports, traces, screenshots, and videos are written below `playwright-report/` and
`test-results/`; both are ignored by Git.
