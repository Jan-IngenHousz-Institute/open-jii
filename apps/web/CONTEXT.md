# Web — Domain Context

Architecture conventions and glossary for the web platform (`apps/web`). Terms used in code, tests, and PRs must match this file. The backend is the source of the ubiquitous language: entity definitions and invariants live in `apps/backend/src/<context>/` and `@repo/api` schemas — this file does not duplicate them, it points at them.

Counterpart of `apps/mobile/CONTEXT.md`, which established the conventions during the mobile DDD finishing pass (OJD-1597).

---

## Architecture conventions

### Boundaries

Feature folders (`features/<f>/`) expose their `hooks/` and `domain/`; `components/` are private to the feature. `shared/` may never import from `features/` — except `shared/providers/`, the composition root (and test files, which wire features the way providers do). `app/` is the routing layer: pages and layouts may deep-import feature components and hooks, but nothing under `features/` or `shared/` may import back into `app/` — server actions live in `shared/api`, not `app/actions`. Enforced by `no-restricted-imports` blocks in `eslint.config.js`; the legacy lists there only shrink.

### Domain modules

Pure rules live in `features/<f>/domain/` as functions over plain data. Three shapes recur:

1. **Cache transforms** — react-query `select` projections and optimistic-update math: old cache + mutation in, next cache out.
2. **Local state machines** — per-transition functions returning partial state, plus derivation predicates (mirror of mobile's `measurement-flow/domain/flow-transitions.ts`).
3. **Permission and validation predicates** mirroring backend use-case invariants (`apps/backend/src/<context>/application/use-cases/`), typed against `@repo/api` schemas.

`domain/**` never imports `react`, `next`, `@tanstack/react-query`, `@repo/ui`, or `shared/api`, and never carries `"use client"` — domain files must stay importable from server and client modules alike. Hooks compose domain + api; components render. The payoff is testability first: domain modules get plain unit tests with no MSW and no rendering.

### Data layer

ts-rest + react-query is the data layer; there is no other store. `shared/api/tsr.ts` is the single client; feature hooks own their queries/mutations and query keys. The typed contract is the seam — no repository wrappers over tsr hooks.

### Composition root

`shared/providers/` builds the provider pyramid (QueryProvider, PostHogProvider) and is the only `shared/` code allowed to import features. The `app/` layer stays thin — this is direction, not current state: some pages are still fat client components (e.g. `app/[locale]/platform/workbooks/[id]/page.tsx`); don't add new ones, and thin them opportunistically when their logic gains a domain module.

### User-facing strings

No hardcoded user-visible English. Same i18n discipline as mobile: all user-visible copy resolves through translation keys present in every supported locale.

---

## Deliberate rejections

Settled during the web finishing pass (OJD-1598), carrying mobile's calls forward. Don't re-propose without new evidence.

- **No per-feature barrels.** Web's rationale is stronger than mobile's tree-shaking argument: a barrel that re-exports client and server-importable modules poisons the RSC boundary — importing one type through it drags `"use client"` modules (CodeMirror, react-flow, dnd-kit) into server module graphs. Deep imports only; the lint bans bare `@/features/<f>` imports.
- **No repository interface over ts-rest.** The contract is fully typed; a second abstraction is pure indirection.
- **No dispatch-union FSM.** Backend use-cases own the state machines (experiment status, join-request lifecycle, workbook publish); web mirrors them as domain predicates.
- **No error-kind registry.** QueryProvider's mutation-cache toasts + `shared/api/apiError.ts` centralize error feedback.
- **No zustand.** react-query cache + URL state (`useUrlState`) + local component state cover web's needs; don't copy mobile's store layer to copy the pattern.
- **No server-actions migration.** The pre-existing `"use server"` files moved to `shared/api` unchanged; converting tsr mutations to server actions is an orthogonal data-layer decision.
- **No RSC-ification drive.** Many components are legitimately `"use client"`; moving logic server-side is a separate performance effort, not part of the DDD-lite shape.
- **No shared domain package (yet).** `packages/api/src/domain/` is the designated landing spot if web and mobile ever demonstrably duplicate the same pure predicate; until then domain modules stay app-local.
- **No route/URL changes.** `app/[locale]/**` paths are SEO/bookmark surface.
- **No internal reorg of `experiment-visualizations`.** It moved as an opaque unit; it is internally coherent.

---

## Feature map

- **experiments** — experiment lifecycle: overview, settings, members/invitations, transfer requests, locations, data table + annotations. Backend mirror: `apps/backend/src/experiments/`.
- **experiment-visualizations** — chart workspace (shelves, axes, chart configs) over experiment data. Web-only; no backend bounded context of its own.
- **experiment-flow** — the react-flow graph editor for experiment question/measurement flows.
- **workbooks** — protocol & macro development workbooks: editor, cell execution, versioning/go-live. Backend mirror: `apps/backend/src/workbooks/`.
- **protocols** / **macros** — library CRUD + code editors; `protocol-run` lives under protocols.
- **iot** — device communication (MultispeQ), sensor families. Backend mirror: `apps/backend/src/iot/`.
- **auth** — login/register/verify flows over Better Auth.
- **account** — account settings + profile.
- **dashboard** — landing dashboard and its cards.
- **navigation** — sidebar/topbar/breadcrumb shell. A feature (not shared/ui) because it composes auth and account hooks; shared/ may not import features.

`shared/` holds the cross-feature substrate: `api` (tsr client, fetch wrapper, error helpers, server actions), `ui` (cross-feature widgets: data-filters, pickers, breadcrumbs, banners, presentational badges), `providers` (composition root), `hooks` (generic React hooks: autosave, debounce, URL state), `i18n`, `analytics` (PostHog), `cms` (Contentful), `utils` (pure helpers).
