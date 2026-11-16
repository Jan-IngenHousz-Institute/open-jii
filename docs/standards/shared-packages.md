# Shared packages

`packages/auth`, `iot`, `cms`, `analytics`, `transactional` and `monitoring`. Each one is small,
each is consumed by more than one place, and the rules they share are about their public surface and
their build.

`packages/api`, `database`, `ui` and `i18n` have their own documents because they carry more
specific rules.

## Rules

1. A package's public surface is the subpaths in its `exports` map, and nothing else is importable.
   Adding a public module means adding an entry on purpose. [review]
2. A platform split is a separate export entry rather than a runtime check. `@repo/auth/client` and
   `@repo/auth/client.native`, `@repo/iot/transport/web` and `@repo/iot/transport/react-native`.
   [review]
3. A package consumed from `dist` must be rebuilt after you change it, or the running code stays
   stale while the types look current. `@repo/api` and `@repo/analytics` are the two that bite most
   often. `@repo/ui` and `@repo/i18n` are consumed from source and need no build. [review]
4. Keep the transport-agnostic core separate from the platform binding. `packages/iot` puts protocol
   logic in `core/` and one directory per device family in `driver/`, and the app supplies the
   transport. A driver that knows it is running in React Native has the layering backwards. [review]
5. One render module per transactional message, exported as its own subpath. It exists so the
   backend can mock a single email in a test rather than the whole package. [review]
6. Feature flags are declared in `packages/analytics/src/feature-flags.ts` with a conservative
   default, so a flag service outage disables a feature rather than enabling it everywhere. Their
   rollout lives in `infrastructure/modules/posthog/flags.json`, and a test in the package fails
   when the two key sets differ. [review]
7. Sessions, permissions and organization rules belong in `packages/auth` and not in the backend.
   The backend mounts the instance and applies guards; it does not re-derive who may do what.
   [review]
8. `@repo/monitoring` is imported one module at a time, never through a barrel, because one module
   pulls in a dependency that a Lambda bundle does not ship. After changing it, rebuild the package
   and the three bundles that copy it. [review]
9. `@repo/cms` and `@repo/ui` do not depend on each other, so a presentation change does not rebuild
   the consumers of CMS data. Rendering that needs both lives in `apps/web`. [review]

## What each one holds

**`packages/auth`** wraps Better Auth on a pinned version and is the single session authority.
`src/access.ts` declares the permission statements, and `src/organization/` is the org plugin split
into plugin, rules, guards, lifecycle and the two email modules, with a spec for each except plugin
and lifecycle. `src/email-otp.ts` is the email code sign-in, `src/passkey.ts` is the passkey plugin,
`src/providers/` holds the ORCID provider and the legacy OAuth sign-in, `src/email/` bridges to
`@repo/transactional`, and `src/api-key-session.ts` handles API-key auth. The backend mounts it
through a Nest adapter. Its test setup mocks `@repo/auth/server` down to `getSession`, and the two
specs that need the real plugins build their own instance on the test database.

**`packages/iot`** is the device protocol, shared by the web app and the mobile app. `src/core/`
holds the transport-agnostic logic, `src/driver/<family>/` is one directory per device family over a
shared base, `src/transport/interface.ts` is the port with web and React Native implementations, and
`src/driver/testing/mock-transport.ts` is the shared double. `src/instrument/` holds the bench
instruments a capture procedure drives, with a registry that matches a procedure's rig to what is
plugged in, `src/procedure/` interprets capture procedures, and `src/calibration/` writes
calibration results back to a device. 34 colocated specs.

**`packages/cms`** is the Contentful data layer: the client, the GraphQL queries in
`src/lib/graphql/`, the generated SDK in `src/lib/__generated/sdk.ts`, which is exported verbatim,
and the alert severity helpers. It holds no rendering. The components and the live preview provider
live in `apps/web/components/cms/`, and the provider is wired into the web app's root layout for
draft mode and live updates. Web, mobile and `@repo/transactional` depend on it.

**`packages/analytics`** is PostHog plus pino in six files: the flag declarations, their defaults
and the person properties a flag is evaluated with, the `pinoConfig` the backend feeds to its
logger, the shared PostHog init, the server client, and a URL redactor that keeps sensitive query
values out of what is reported.

**`packages/transactional`** is React Email templates plus 23 thin `render/*` modules, one per
message, with the content of some of them read from the CMS package.

**`packages/monitoring`** holds the decision logic for the platform heartbeat and the public status
page, split so that the part worth testing is not inside a Lambda: parsing the metrics catalogue,
turning the heartbeat file into datapoints, turning cost answers into daily, weekly and monthly
spend, and judging each status component from its probes and readings. The Lambdas under
`infrastructure/modules` are thin wrappers around it, which is why this package has tests and they
do not. The status app and the devkit import it directly.

## Tests

`packages/auth` has 10 test files, `packages/iot` has 34, `packages/monitoring` has 12 and
`packages/analytics` has 5, all colocated. `cms` and `transactional` have none and no vitest
configuration.

## Known debt

`packages/analytics` maps `types` to `./src/*.ts` while `default` points at `./dist/*.js`. The
editor therefore type-checks against source you have just edited while the running code is whatever
was last built, which produces a confusing class of bug where the types agree and the behaviour does
not. Pointing types at `dist` would surface the staleness honestly. Needs a ticket.

`packages/cms` has no tests at all, and both the web app and the mobile app render its output. It is
also the package most likely to break from an external schema change. Needs a ticket.

`packages/auth` mixes `.spec.ts` and `.test.ts`, five of each, and `apps/e2e` mixes them too,
eleven and one. No ticket.

`packages/transactional` has no tests. That is lower risk than the CMS client, because a broken
email template fails loudly. No ticket.

`packages/cms/package.json` and `packages/ui/package.json` stay independent of each other only by
convention, against rule 9, because nothing checks it. Needs a ticket.

## Decisions

- 2026-09-21. Permissions stay in `packages/auth` rather than being re-derived in the backend, even
  though it means a backend change sometimes has to go through a package rebuild. One authority for
  who may do what is worth the extra step.
- 2026-09-22. `packages/monitoring` exists so the heartbeat's decision logic can be tested without
  invoking a Lambda. Anything in a monitoring Lambda that is worth an assertion belongs here
  instead.
- 2026-09-21. The generated Contentful SDK is exported verbatim rather than wrapped. A wrapper would
  have to be regenerated alongside it, and there is nothing to add.
- 2026-11-16. This document was reconciled with main on 16 November 2026.
