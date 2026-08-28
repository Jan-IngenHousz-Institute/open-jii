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

In another terminal, once both applications are ready, run the suite:

```sh
pnpm --filter @repo/e2e exec playwright install chromium
pnpm e2e
```

The default web URL is `http://localhost:3000`, the seed identity is `seed@openjii.local`, and the
database is `postgresql://postgres:postgres@127.0.0.1:5432/openjii_local`. Override them with
`E2E_BASE_URL`, `E2E_EMAIL`, and `E2E_DATABASE_URL` when needed. Authentication state is recreated
under `.auth` for every run. Fixture cleanup only accepts the `openjii_local` database on a loopback
host unless `E2E_ALLOW_UNSAFE_DATABASE=1` is set.

The Web E2E workflow runs nightly, on manual dispatch, and on pull requests that change the web E2E
stack. It uses a production build and its standalone server while local development uses `next dev`.
Playwright owns the CI server processes and waits for the backend health check and rendered login
page before authentication starts.

## Tests and artifacts

- `specs/chrome-refresh.spec.ts` covers the authenticated application shell and experiment chrome.
- `specs/workbook-search.spec.ts` covers server-side workbook search and attachment.
- `scripts/record-maintenance.ts` records maintenance-mode screenshots and video but is not a test.
- `scripts/capture-docs-media.ts` stages documentation screenshots and recordings for `apps/docs`.

## Documentation media

The docs site's web screenshots come from here because this package already owns a browser and a
seeded session. Shots are declared in `docs-media/shots.ts` and the published frames in
`docs-media/frames.ts`; both are explained in `apps/docs/media/web/README.md`.

```sh
pnpm --filter @repo/e2e capture-docs-media --list
pnpm --filter @repo/e2e capture-docs-media --only dashboard,experiments-list
pnpm --filter @repo/e2e capture-docs-media --theme dark
```

Captures are staged in `apps/docs/.capture/web` and are never published automatically. `ffmpeg` is
required for the scale, metadata strip and encode.

HTML reports are written below `playwright-report`. Failed runs retain screenshots and videos below
`test-results`, and CI retries capture traces there; both directories are ignored by Git.
