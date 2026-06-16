# Maintenance page (Contentful resilience)

The public marketing/info pages (`/`, `/about`, `/faq`, `/blog`, `/policies`,
`/terms-and-conditions`, `/cookie-policy`) render content from Contentful. When
Contentful is unreachable or its access token is stale, those fetches fail with
an HTTP error (`401 ACCESS_TOKEN_INVALID`, `404 NotFound`, network timeout, …).

Previously any such failure surfaced as a bare **HTTP 500** to the visitor.
Now it degrades to a branded maintenance page instead:

![Maintenance page shown when Contentful is unavailable](./assets/maintenance-page.gif)

## How it works

A Contentful outage can throw in three different places, each handled
separately because Next.js routes them through different mechanisms:

| Where it throws                     | Handler                                                                                                                         | Result                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Page body (Server Component)        | [`app/[locale]/error.tsx`](../app/[locale]/error.tsx) and [`app/[locale]/(info)/error.tsx`](<../app/[locale]/(info)/error.tsx>) | Maintenance page, navigation shell preserved                                      |
| `generateMetadata`                  | [`lib/safe-metadata.ts`](../lib/safe-metadata.ts)                                                                               | Swallowed → falls back to default metadata, so the body throw above can be caught |
| Root layout / anything that escapes | [`app/global-error.tsx`](../app/global-error.tsx)                                                                               | Maintenance page (full document)                                                  |

Why all three are needed:

- **`error.tsx`** only catches errors thrown while React renders a route's
  Server/Client components. It renders client-side, so a `curl` (no JS) still
  sees a skeleton 500 document — a real browser shows the maintenance page.
- **`generateMetadata` runs outside React rendering**, so a throw there is _not_
  caught by `error.tsx` and would bypass the maintenance page as a raw 500.
  `safeMetadata()` wraps each CMS-backed `generateMetadata` so it returns the
  root layout's fallback metadata instead of throwing.
- **`global-error.tsx`** is the last-resort boundary for anything that escapes
  the segment boundaries (e.g. a root-layout failure). It must render its own
  `<html>`/`<body>`.

Non-critical CMS reads degrade silently rather than showing the maintenance page:

- The global [`AlertsBar`](../components/alerts-bar.tsx) returns `null` on failure.
- The info-group [layout footer](<../app/[locale]/(info)/layout.tsx>) renders without a footer on failure.

The shared [`MaintenancePage`](../components/maintenance-page.tsx) component is
the UI used by all of the boundaries above.

Authenticated `/platform/**` pages do not read from Contentful, so a Contentful
outage does not affect them.

## Mobile app

The mobile app (`apps/mobile`) reads from Contentful in two places, and both
already returned `null`/`[]` when credentials were _missing_ — but a present-but
-stale token (a `401 ACCESS_TOKEN_INVALID`) still threw. With no maintenance
page concept on a native app, the right behavior is to degrade silently:

- **Active alerts** ([`fetch-active-alerts.ts`](../../mobile/src/features/alerts/services/fetch-active-alerts.ts))
  now catches request failures and returns `[]`. Previously the throw reached the
  global React Query `onError`, which showed the entire graphql-request error
  body in a toast that filled the screen.
- **Force-update gate** ([`fetch-force-update.ts`](../../mobile/src/features/force-update/services/fetch-force-update.ts))
  is intentionally left to throw: its query uses `suppressToast`, `offlineFirst`,
  and `gcTime: Infinity` so a failed refresh **keeps the last-known cached gate**.
  Swallowing the error to `null` would overwrite that cache and un-gate users
  during an outage, so the throw is load-bearing there.

## Reproducing / recording it locally

The maintenance page only renders for real (client-side hydrated) browsers, so
use the Playwright recorder rather than `curl`:

```bash
cd apps/web

# 1. Build and run WITHOUT Contentful creds (simulates the outage)
env -u CONTENTFUL_SPACE_ID -u CONTENTFUL_ACCESS_TOKEN \
    -u CONTENTFUL_PREVIEW_ACCESS_TOKEN -u CONTENTFUL_PREVIEW_SECRET \
    pnpm exec next build --webpack
env -u CONTENTFUL_SPACE_ID -u CONTENTFUL_ACCESS_TOKEN \
    -u CONTENTFUL_PREVIEW_ACCESS_TOKEN -u CONTENTFUL_PREVIEW_SECRET \
    pnpm exec next start -p 3000 &

# 2. Record a video + screenshots of the fallback across the public pages
OUT_DIR=/tmp/maint-rec python3 e2e/record_maintenance.py
```

Outputs land in `OUT_DIR`: `maintenance.webm` plus a PNG per page. The recorder
asserts the "back soon" heading is present on each page, so it doubles as a
smoke test.
