# openJII Web

The openJII web app — the public website (openjii.org) and the authenticated research platform, in one Next.js (App Router) application.

## Structure

Routes live under `app/[locale]/` (i18n via `@repo/i18n`, en-US and de-DE):

- **Public site** — the homepage and `(info)` pages (about, blog, FAQ, policies, releases). Content is fetched from Contentful through `@repo/cms`; when Contentful is unavailable, pages degrade to a maintenance page.
- **`(auth)`** — login, registration, and verification pages, backed by Better Auth (`@repo/auth`).
- **`platform/`** — the authenticated research platform (experiments, workbooks, protocols, macros, devices, account), wrapped in the sidebar/topbar chrome with command palette and keyboard shortcuts.

Data fetching uses the oRPC client against the backend's contract (`@repo/api`) with TanStack Query. UI components come from `@repo/ui` (shadcn/Radix) with the shared Tailwind theme.

## Development

Run from the repo root:

```bash
pnpm db:setup          # local Postgres + migrations (once)
pnpm dev:fb            # web + backend together
# or just this app:
pnpm --filter web dev
```

### Environment

Copy `.env.example` to `.env.local` and fill in the values. For analytics/feature flags, set your PostHog key (from the PostHog project settings):

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_YOUR_KEY_HERE
```

### Testing

```bash
pnpm --filter web test
pnpm --filter web lint
```

## Deployment

The app is built with [OpenNext](https://opennext.js.org) (`pnpm --filter web build:opennext`) and deployed to AWS — not Vercel.

## Documentation

- [Maintenance Page](./docs/MAINTENANCE_PAGE.md) — how public pages degrade when Contentful is unavailable
- [PostHog Integration](./docs/POSTHOG.md) — feature flags and analytics setup
- [Platform docs](https://docs.openjii.org) — researcher and developer documentation
