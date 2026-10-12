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
- `scripts/capture-ticket-screens.ts` captures the screens a Linear ticket carries.
- `pnpm --filter @repo/e2e test` runs the unit tests for the capture tooling, not the browser suite.

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

## Ticket screens

A Linear ticket that changes a screen carries a picture of the change, taken from the real app with
the change scaffolded into it. A local stack has no warehouse, so `ticket-screens/` holds fixtures
that answer the requests it cannot, installed in the browser before the page loads:

- `FixtureWarehouse` answers an experiment's four data routes from fixture tables, with the
  filter, bucket, aggregate and paging rules of the backend's query builder.
- `NonMemberView` shows an experiment as a signed-in non-member sees it.
- `FixtureRoute` answers one path with a fixed body, and `FixtureTransform` rewrites a real one.
- `HideTestPrefixes` drops `[Seed]` and `[Local]` from every name, and runs on every shot.
- `ChangeMarker` outlines the changed part with a short tag and returns the crop around it.

Shots live in `ticket-screens/shots.ts`. The one shot on `main` is an example; a project adds its
own on its scaffold branch, which is never merged. Sign in once, then capture:

```sh
pnpm --filter @repo/e2e exec playwright test --project setup
pnpm --filter @repo/e2e capture-ticket-screens --list
pnpm --filter @repo/e2e capture-ticket-screens --only example-data-table
```

Captures land in `apps/e2e/.ticket-screens` as 2x PNGs, with a `.failed.png` beside any shot that
stopped, showing where. The fixture tables in `ticket-screens/fixture-tables.ts` are generic example
data; a project that needs other shapes adds its own tables beside them.

HTML reports are written below `playwright-report`. Failed runs retain screenshots and videos below
`test-results`, and CI retries capture traces there; both directories are ignored by Git.
