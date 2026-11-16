# Mobile app

`apps/mobile`, the field companion. Expo with expo-router, NativeWind 5 on Tailwind v4 for styling,
Zustand for local state, TanStack Query for server state, and drizzle over expo-sqlite for the
on-device database.

Android is the only published platform, because data collection needs USB serial and Bluetooth
Classic and neither is available on iOS.

Styling is `apps/mobile/docs/styling.md` and the domain vocabulary is `apps/mobile/CONTEXT.md`.
Neither is repeated here.

## Read first

- `apps/mobile/CONTEXT.md` for what the words mean, because this app has its own vocabulary.
- `apps/mobile/docs/styling.md` before touching anything visual.
- `apps/mobile/eslint.config.mjs`, which encodes the feature boundaries as lint rules.

## Shape

```text
src/app/                      routes only, nothing else
src/features/<feature>/       twelve features, each with the subset of layers it needs
  components/ screens/        private to the feature
  hooks/ stores/ services/    the feature's public surface
  domain/ utils/              pure logic, where a feature has any
src/shared/                   api, composition, db, device, i18n, observability, stores, ui, ...
drizzle/                      sqlite migrations, 0000 upward
```

`measurement-flow` is the fullest feature and the one to copy: it has components, domain, hooks,
screens, services, stores and utils. Several tab routes are thin re-export shells pointing at a
feature screen, which is why `src/app/**` is excluded from coverage.

## Rules

1. `src/app/` holds routes and nothing else. A route is a screen import or a thin shell; the screen
   itself lives in the feature. [review]
2. A feature's public surface is its `hooks`, `stores`, `services`, `utils` and `types`. Its
   `screens` and `components` are private, and another feature importing them is an error rather
   than a style preference. [lint: no-restricted-imports]
3. `shared/` never imports from `features/`. The dependency runs one way, and shared UI belongs in
   `shared/ui`. [lint: no-restricted-imports]
4. Both legacy exception lists in the lint config are empty. Keep them that way: a new violation is
   a hard error, and adding a file to the list to get a build through defeats the only mechanism
   holding the boundaries. [review]
5. Style with NativeWind `className` and semantic tokens. Never `StyleSheet.create`, and never
   branch on `theme.isDark`; use the `dark:` variant instead. Two steps of the job grep for these,
   named `Forbid StyleSheet.create in apps/mobile/src` and
   `Forbid theme.isDark / isDark? ternaries in apps/mobile/src`. [ci: Mobile Styling Guard]
6. A native module is wrapped in a service under `features/connection/services`, and UI never
   imports a native package directly. The device protocol itself lives in `packages/iot`, and this
   app supplies only the React Native transport. [review]
7. Anything that must survive a restart goes through the SQLite layer in `shared/db`, and anything
   that must reach the server goes through the outbox rather than a direct call. A measurement is
   written locally first and uploaded from the queue. [review]
8. Long-lived singletons live on `globalThis` through `shared/composition/upload.ts`, not in
   module-level `let` bindings. Fast Refresh re-evaluates a module and resets a `let`, which leaves
   the previous pipeline running inside closures the collector cannot reach, and N reloads become N
   live outboxes draining the same queue. Read the comment in that file before adding a singleton.
   [review]
9. Use the status vocabulary from `CONTEXT.md` exactly. A measurement is `pending`, `successful` or
   `failed`, and there is deliberately no `uploading`. [review]
10. File names are kebab-case. [review]
11. Import with the `~/` alias, which is what the boundary rules are written against. This differs
    from the web app on purpose. [review]
12. Every string a user reads goes through `src/shared/i18n`, with a key in both `en-US` and
    `nl-NL` in the same change. A label vocabulary built from a server enum gets a test that checks
    both locales, as `organization-role-label.test.ts` does. [review]
13. Report a caught error through a logger from `shared/observability`, which sends an error line
    to PostHog as an exception. Pass `report: false` only for an expected failure, such as a device
    dropping mid-scan. [review]

## Patterns

**Adding a feature.** Copy the layer set of the closest existing feature rather than creating every
directory. Only four features have a `domain/`, and that is fine; a feature with no pure logic
should not grow an empty folder for symmetry. `discover` has only `components/` and `screens/` and
takes its data from the hooks of `experiments`, which is the shape to copy for a feature that only
presents another feature's data.

**Adding something to the upload path.** Read `shared/composition/upload.ts` first. It is the only
place that constructs the two transports, the MQTT one and the one for oversized measurements, and
the outbox. Everything else takes them as injected dependencies, and tests substitute fakes at that
seam.

**Reaching the local backend from a cabled phone.** `pnpm --filter mobile adb:reverse` is what makes
Metro and the backend reachable. The `openjii-mobile-device` skill covers getting a build onto a
phone and `openjii-mobile-control` covers driving one.

**A device double.** Derive it from the firmware or the vendor source, never from your reading of
the protocol. `packages/iot/src/driver/testing/mock-transport.ts` is the shared double.

## Tests

Vitest with two projects in one config, 185 colocated `.test.ts` and `.test.tsx` files. The `node`
project runs logic and React Native Testing Library; the `jsdom` project picks up anything under
`src/**/hooks/**` that needs a DOM. This is the only workspace with enforced coverage thresholds:
35% globally, and per layer 85% on `features/**/domain/**`, 75% on `shared/db/**`, 70% on
`features/**/hooks/**` and `shared/api/**`, and 65% on `features/**/services/**`. CI caps workers at
two because the suite was being killed for memory.

## Known debt

`src/shared/ui` mixes two naming conventions, with 13 PascalCase files such as `Button.tsx` and
`TabBar.tsx` alongside 16 kebab-case ones. There is both a `TabBar.tsx` and an
`animated-tab-bar.tsx`, which is the confusing case. Renaming the 13 is mechanical but touches every
import of them. Needs a ticket.

Feature shape is uneven in ways that look accidental rather than chosen. `auth` keeps its two HTTP
calls in an `api/` directory beside `services/`, `profile` has a `widgets/` directory no other
feature has, and `release-notes` keeps a loose `category.ts` at its root. No ticket.

`features/connection/utils/` is a collection of micro-helpers: `delay.ts`, `emitter.ts`,
`keep-truthy.ts`, `safe-async.ts`, `stringify-if-object.ts`, `generate-random-string.ts`. Several
have a standard-library or dependency equivalent, and the rest belong on the service that uses
them. No ticket.

`postinstall` rebuilds five workspace packages with a chain of `cd ../../packages/x && pnpm run
build && cd -`, which is slow and hides a failure in the middle. No ticket.

The two styling rules are grep jobs in the pull request workflow rather than lint rules, so the
editor does not tell you and CI does. Moving them into `eslint.config.mjs` as restricted properties
would fix that. Needs a ticket.

`src/shared/db/measurements-storage.ts` is 582 lines and the largest non-test file here. No ticket.

There are 132 type assertions in non-test source, not counting `as const`, 4 of them `as any`. No
ticket.

The `lint` script in `apps/mobile/package.json` runs `eslint 'src/**/*' --fix`, so in CI a finding
with an automatic fix is repaired on the runner instead of failing the build. The boundary rules in
rules 2 and 3 have no fix and still fail it. No ticket.

`src/shared/ui/error-boundary.tsx`, `src/shared/ui/Dropdown.tsx`, `src/shared/ui/result-view.tsx`
and `src/features/alerts/components/alert-banner.tsx` hard-code English text that a user reads,
against rule 12, and so do other files. No ticket.

## Decisions

- 2026-09-21. Mobile keeps the `~/` alias while the web app standardises on `@/`. The boundary lint
  patterns are written against `~/features/...`, and rewriting them to gain consistency with a
  different app buys nothing.
- 2026-09-21. An uneven feature layer set is acceptable. A feature gets `domain/` when it has pure
  logic worth separating, and creating one everywhere for symmetry would leave empty directories
  that imply a layer exists when it does not.
- 2026-11-16. This document was reconciled with `main` on 16 November 2026, and the counts, paths
  and tags that had drifted were corrected.
