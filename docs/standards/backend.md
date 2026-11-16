# Backend

`apps/backend`, the NestJS API on port 3020. It serves the contracts from `packages/api` over oRPC
and talks to Postgres through drizzle and to the lakehouse through Databricks.

The contracts themselves are `api.md`, the schema and migrations are `database.md`, and the
cross-cutting language rules are [code.md](code.md). This document is about how a domain in here is
put together.

## Read first

- `apps/backend/README.md` for running it, and `apps/backend/.env.example` for what it needs to boot.
- [code.md](code.md), which this document does not repeat.
- `apps/backend/src/experiments/`, which is the fullest example of everything below.

## Shape

A domain is a directory under `src/`, and the layers inside it always appear in the same places:

```text
src/<domain>/
  core/
    models/         drizzle-zod schemas and the types derived from them
    ports/          one file per capability: a Symbol token plus the interface
    repositories/   the queries, returning Result
    <rule>.ts       pure domain rules that need no port, such as access and staffing decisions
  application/
    use-cases/<verb-noun>/<verb-noun>.ts    one class per use case
    services/       logic shared by several use cases in this domain
    indicators/     health indicators, in the health domain only
  presentation/     the controller that implements the contract
    hooks/          auth lifecycle hooks, in the users and organizations domains only
  <domain>.module.ts
```

Adapters do not live in the domain. They sit in `src/common/modules/<capability>/` and are bound to
the domain's port token in the domain module, which is what keeps `core/` free of anything that
talks to the outside world.

The files worth opening before you write anything:

| For                              | Open                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| A use case                       | `src/experiments/application/use-cases/create-experiment/create-experiment.ts` |
| A controller                     | `src/experiments/presentation/experiment.controller.ts`                        |
| A port                           | `src/experiments/core/ports/databricks.port.ts`                                |
| Result and AppError              | `src/common/utils/fp-utils.ts`                                                 |
| Converting a failure at the edge | `src/common/utils/orpc-fp.ts`                                                  |
| A controller spec                | any `*.controller.spec.ts`, and `src/test/test-harness.ts`                     |

Thirteen of the fifteen domains carry core, application and presentation layers. The rest have only
the layers they need, which is fine; what is not fine is inventing a new layer name.
`src/authorization/` holds the guards and decorators every controller uses and is not itself a
domain.

## Rules

1. Copy the closest sibling domain before adding anything. `experiments` is the reference, and for
   a smaller domain `macros` or `protocols` is closer in size. Matching the neighbours matters more
   than a locally better idea. [review]
2. Every piece of logic belongs to a class: a use case, a service, a repository, an adapter or a
   controller. A file that defines a class has no functions at file scope, so a helper too small
   for its own class becomes a private method on the class that needs it. [review]
3. One use case per class, in its own folder named for the verb and the noun, exposing a single
   `async execute(...)` that returns `Promise<Result<T>>`. A use case holds no mutable state
   between calls. If it needs caching, that is a `CachePort` on the domain and an adapter behind
   it, not a field. [review]
4. A port is named for the capability it describes and not for the domain that owns it, so five
   domains each declare their own `DatabricksPort` and the importing file aliases it when two
   collide. Each port file exports the interface and a `Symbol` token, and the domain module binds
   the token to an adapter with `useExisting`. [review]
5. Failures are return values. Nothing under `core/` or `application/` throws: return
   `failure(AppError.badRequest(...))` and let the caller decide. `AppError` already carries the
   status code, so the edge does not have to guess. [review]
6. A controller method implements exactly one contract procedure. It reads the session, calls one
   use case, shapes the success with `formatDates` or `toPage`, and hands a failure to
   `throwOrpcFailure`. It does not branch on business state; if you find yourself writing an `if`
   about the domain in a controller, it belongs in the use case. [review]
7. Authorization is declarative. Put `@CanAccess({ resource, action })` or `@CanCreateInOrg()` on
   the method and let the guard do it, rather than re-deriving permissions inside the use case.
   [review]
8. Shape validation belongs to the zod contract in `packages/api`, which runs before your code
   does. A use case guards only what a schema cannot express: ownership, whether a state
   transition is legal, and invariants that span records. [review]
9. Every log call passes an object, never an interpolated string, and every object carries `msg`
   and `operation`. The logger is a private field named after its class, which is what makes a line
   traceable to the code that wrote it. [review]
10. A repository owns its own query construction and returns `Result`. Two styles exist for good
    reasons: drizzle's query builder against Postgres, and hand-built SQL against Databricks. A
    repository that writes its own Databricks SQL sends every value as a statement parameter
    through `executeSqlQuery`. Only the query builders under `common/modules/` write values into
    SQL text, and they do it through their escaping helpers, which are mandatory there. A
    capability that is moving between stores keeps one repository per store behind the use case
    until the move is finished. [review]
11. An adapter in `common/modules/` may implement ports from several domains, but it must not reach
    into another domain's `core/` for types. If two domains need the same row shape, the shape
    belongs in the port each of them declares. [review]
12. Specs are `.spec.ts` next to the code they cover. A controller spec goes through `TestHarness`
    and addresses routes with `resolveOrpcPath(contract...)` rather than a literal path string, so
    a contract change breaks the test instead of silently passing. [review]
13. Keep a spec in a directory the test sequencer recognises. It orders files bottom-up by layer,
    from `/utils/` through `/repositories/` and `/use-cases/` to `/presentation/`, and only prints
    a warning for a file it cannot classify. [review]
14. Scheduled work is a service under `application/services/` carrying a `@Cron` or `@Interval`
    decorator. Write it so that two instances running it at once do no harm. A job on a short
    interval has a quiet stand-in in `src/test/` that `TestHarness` swaps in, so its timer does not
    fire during a suite. [review]
15. Read a feature flag through the domain's `AnalyticsPort`, with the flag name from
    `FEATURE_FLAGS` and the acting user, rather than from an environment variable. [review]
16. Return another person's email through `EmailVisibilityService` and a contributor's name through
    `ContributorAnonymizerService`, so a new read path cannot leak what those rules withhold. Logs
    carry ids and never addresses, as rule 20 of [prose.md](prose.md) says. [review]

## Patterns

**Adding a use case.** Create the folder under `application/use-cases/`, write the class with a
private logger and constructor-injected repositories, and register it in the domain module next to
its siblings. Then give the controller a method that calls it. The order matters: if the contract
does not exist yet, it comes first, in `packages/api`.

**Reading `create-experiment.ts` critically.** Its structure is the model to copy: the injected
repositories and port, the single `execute`, the `Result` chaining, the structured logs, and the
blank lines that let you see the shape of the function before reading it. Two things in it are not
the model. The guards on `userId` and on an empty `name` are shape validation that the contract
already does, which is rule 8 going the wrong way, and three of its comments announce the line
underneath them rather than explaining anything. The comment about filtering the creator out of the
collaborator list is the one that earns its place, because nothing in the code says why.

**Converting a failure.** `throwOrpcFailure` maps the status code on `AppError` to an oRPC code,
logs at error from 500 upward and at warn below it, and sends the error details to the client only
outside production. `OrpcErrorInterceptor` reports anything it throws with a status of 500 or
above. Call it and return; do not build an `ORPCError` by hand.

**Reading experiment tables.** The data controller asks `ExperimentDataSourceService` which source
the user reads from and passes the answer to the use case. The repository builds the read through
`ExperimentWarehouseReadsService` or `ExperimentStoreReadsService`, which both implement
`ExperimentTableReads`. A change to a table's columns changes the view the warehouse reads and the
serving store migration, so change both together.

**Notifying someone.** Call `NotificationDispatchService.dispatch` from the use case that changed
something. It stores a row per recipient and queues the email, which `NotificationOutboxWorker`
sends, so email never goes out inline. A failure to dispatch is logged and does not fail the
action that caused it.

**Testing against a real database.** `pretest` starts Postgres on port 5433 and `posttest` tears it
down, so a spec run outside `pnpm test` needs `db:test:setup` first. The suite is load-sensitive,
with timeouts that fail under a parallel turbo run, so run it on its own when you are checking
whether something is broken.

## Tests

Colocated `.spec.ts`, 368 files today and no `.test.ts`. Vitest runs with `fileParallelism: false`
and `isolate: false`, so files share a worker and order is decided by the layer sequencer. The only
adapter that gets mocked wholesale is analytics; everything else talks to the real test database
through `TestHarness`, which also provides `createTestUser` and supertest verbs that carry a
session. The serving store adapter spec needs a throwaway ClickHouse and is skipped without
`CLICKHOUSE_TEST_URL`. CI does not provide one today, so it only runs on a developer's machine.

## Known debt

`src/common/modules/databricks/databricks.adapter.ts` is 1,369 lines and serves the Databricks port
of five domains at once, importing row types from the `core/models` of `experiments` and `iot`.
That is rule 11 broken, and its spec is longer still. The serving store adapter, its client service
and `store-tables.ts` import `experiments/core/models` the same way. Splitting the Databricks
adapter per domain is the fix. Needs a ticket.

Eight use-case files keep helpers at file scope instead of as private methods, against rule 2:
`create-join-code.ts`, `get-iot-device-group-monitoring.ts`, `get-iot-fleet-monitoring.ts`,
`list-experiment-devices.ts`, `list-organization-resources.ts`, `global-search.ts`,
`notify-credential-added.ts` and `is-workbook-upgradable.ts`. The two monitoring use cases hold the
same `bucketsInWindow`. Repositories, services and `protocols/presentation/protocol.controller.ts`
do the same. Move the helpers onto the class next time a file is open. No ticket.

47 of the 202 use-case files sit in a folder shared by several use cases, such as
`experiments/application/use-cases/experiment-join-codes`, against rule 3. No ticket.

Ports are declared two ways. Most are an interface plus a Symbol, but `CachePort` in three domains
and `LambdaPort` in macros are abstract classes. Both work with Nest's injector and neither is
wrong, but a reader has to notice which they are looking at. Settle on the interface form when one
of them is next touched. No ticket.

`src/common/utils/` holds 25 files that mix genuinely generic helpers, such as `fp-utils.ts` and
`pagination.ts`, with domain vocabulary, such as `access-wording.ts`, `activity-sort.ts`,
`owning-organization.ts`, `profile-anonymization.ts`, `resource-access-scope.ts` and
`role-tokens.ts`. The domain ones belong in the domain that speaks that language. Add nothing to
this directory, and move an item out when you touch it. No ticket.

Eight specs sit at the root of `organizations/` rather than in a layer, so the sequencer classifies
them only by the `/organizations/` fallback, and eleven more match no layer segment and print the
sequencer's warning, against rule 13. They include `sharing/core/resource-staffing.spec.ts`,
`experiments/core/export-filename.spec.ts`, the four `health/application/indicators` specs and
`users/play-review-sign-in.spec.ts`. No ticket.

Four controller specs address routes by literal path, against rule 12:
`health/presentation/health.controller.spec.ts` and the data, exports and uploads controller specs
under `experiments/presentation/`. Use `resolveOrpcPath` wherever the route has a contract entry.
No ticket.

About 70 of roughly 780 log calls pass a string or an object without `operation`, against rule 9,
mostly in `common/utils/async-queue.ts`, `common/modules/cache/cache.adapter.ts` and
`common/modules/databricks/services/pipelines/pipelines.service.ts`. Fix them in the files you are
editing. No ticket.

`protocols/presentation/protocol.controller.ts` parses and validates protocol code in functions at
file scope, against rules 2, 6 and 8. The shape check belongs in the contract or `packages/api`,
and the rest in a use case. No ticket.

`tooling/eslint/nest.js` turns `@typescript-eslint/no-explicit-any` off, so rule 3 of
[code.md](code.md) is a `[review]` rule in this app, not a `[lint]` one. No ticket.

`test/app.e2e-spec.ts` and `test/jest-e2e.json` are a Jest harness nothing runs any more. Delete
them. No ticket.

The no-mutable-state half of rule 3 is currently kept: no use case in the app holds a mutable
field.

## Decisions

- 2026-09-21. Rule 4 keeps the capability-first port name even though it means five interfaces
  called `DatabricksPort`, because the alternative is a domain prefix on every port in the app to
  solve a collision that only appears in one adapter.
- 2026-09-21. Rule 10 accepts two repository styles rather than forcing one. The Databricks side
  cannot use drizzle, and pretending otherwise would mean a fake abstraction over two databases
  that behave differently.
- 2026-09-21. `create-experiment.ts` stays the exemplar despite its two guards and its narrating
  comments, because its structure is right and a document that only points at perfect code has
  nothing to point at.
- 2026-11-16. Reconciled with main, so the counts, the rules, the patterns and the debt lines follow
  the code as it stands.
