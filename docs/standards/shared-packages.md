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
   default, so a flag service outage disables a feature rather than enabling it everywhere. [review]
7. Sessions, permissions and organization rules belong in `packages/auth` and not in the backend.
   The backend mounts the instance and applies guards; it does not re-derive who may do what.
   [review]

## What each one holds

**`packages/auth`** wraps Better Auth on a pinned version and is the single session authority.
`src/access.ts` declares the permission statements, `src/organization/` is the org plugin split into
plugin, rules, guards and lifecycle with a spec for each, `src/providers/orcid.ts` is a custom OAuth
provider, `src/email/` bridges to `@repo/transactional`, and `src/api-key-session.ts` handles
API-key auth. The backend mounts it through a Nest adapter and its test setup mocks
`@repo/auth/server` wholesale, so no spec opens a session store.

**`packages/iot`** is the device protocol, shared by the backend and the mobile app. `src/core/`
holds the transport-agnostic logic, `src/driver/<family>/` is one directory per device family over a
shared base, `src/transport/interface.ts` is the port with web and React Native implementations, and
`src/driver/testing/mock-transport.ts` is the shared double. 22 colocated specs.

**`packages/cms`** is the Contentful client with GraphQL codegen. Queries live in `src/lib/graphql/`
and the generated SDK in `src/lib/__generated/sdk.ts`, which is exported verbatim. Content types are
feature folders, and the preview provider is wired into the web app's root layout for draft mode and
live updates. Mobile depends on it too, for release notes and alerts.

**`packages/analytics`** is PostHog plus pino in five files: the flag declarations and their
defaults, the `pinoConfig` the backend feeds to its logger, the shared PostHog init, and the server
client.

**`packages/transactional`** is React Email templates plus eleven thin `render/*` modules, one per
message.

**`packages/monitoring`** holds the decision logic for the platform heartbeat, split so that the
part worth testing is not inside a Lambda: parsing the metrics catalogue and building the CloudWatch
queries, deriving baselines and deciding what counts as an anomaly, formatting the Slack digests,
and turning the heartbeat file into datapoints. The Lambdas are thin wrappers around it, which is
why this package has tests and they do not.

## Tests

`packages/auth` has 5 specs, `packages/iot` has 34 and `packages/monitoring` has 6, all colocated.
`cms`, `analytics` and `transactional` have none and no vitest configuration.

## Known debt

`packages/analytics` maps `types` to `./src/*.ts` while `default` points at `./dist/*.js`. The
editor therefore type-checks against source you have just edited while the running code is whatever
was last built, which produces a confusing class of bug where the types agree and the behaviour does
not. Pointing types at `dist` would surface the staleness honestly. Needs a ticket.

`packages/cms` has no tests at all, and both the web app and the mobile app render its output. It is
also the package most likely to break from an external schema change. Needs a ticket.

`packages/auth` is the only workspace mixing `.spec.ts` and `.test.ts`, with three and two. No
ticket.

`packages/transactional` and `packages/analytics` have no tests. Lower risk than the CMS client,
because a broken email template fails loudly and the flag defaults are conservative. No ticket.

## Decisions

- 2026-09-21. Permissions stay in `packages/auth` rather than being re-derived in the backend, even
  though it means a backend change sometimes has to go through a package rebuild. One authority for
  who may do what is worth the extra step.
- 2026-09-22. `packages/monitoring` exists so the heartbeat's decision logic can be tested without
  invoking a Lambda. Anything in a monitoring Lambda that is worth an assertion belongs here
  instead.
- 2026-09-21. The generated Contentful SDK is exported verbatim rather than wrapped. A wrapper would
  have to be regenerated alongside it, and there is nothing to add.
