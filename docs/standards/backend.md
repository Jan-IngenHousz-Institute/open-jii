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
  application/
    use-cases/<verb-noun>/<verb-noun>.ts    one class per use case
    services/       logic shared by several use cases in this domain
  presentation/     the controller that implements the contract
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

Nine of the fifteen domains carry the full set of layers. The rest have only the layers they need,
which is fine; what is not fine is inventing a new layer name.

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
4. A port is named for the capability it describes and not for the domain that owns it, so four
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
    reasons: drizzle's query builder against Postgres, and hand-built SQL strings against
    Databricks, where the escaping helpers in `common/modules/databricks/services/query-builder`
    are mandatory rather than optional. [review]
11. An adapter in `common/modules/` may implement ports from several domains, but it must not reach
    into another domain's `core/` for types. If two domains need the same row shape, the shape
    belongs in the port each of them declares. [review]
12. Specs are `.spec.ts` next to the code they cover. A controller spec goes through `TestHarness`
    and addresses routes with `resolveOrpcPath(contract...)` rather than a literal path string, so
    a contract change breaks the test instead of silently passing. [review]
13. Keep a spec in a directory the test sequencer recognises. It orders files bottom-up by layer,
    from `/utils/` through `/repositories/` and `/use-cases/` to `/presentation/`, and prints a
    warning for a file it cannot classify. [ci: Build, Lint, & Test]

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
logs at error above 500 and warn below it, and includes the error details only outside production.
Call it and return; do not build an `ORPCError` by hand.

**Testing against a real database.** `pretest` starts Postgres on port 5433 and `posttest` tears it
down, so a spec run outside `pnpm test` needs `db:test:setup` first. The suite is load-sensitive,
with timeouts that fail under a parallel turbo run, so run it on its own when you are checking
whether something is broken.

## Tests

Colocated `.spec.ts`, 299 files today and no `.test.ts`. Vitest runs with `fileParallelism: false`
and `isolate: false`, so files share a worker and order is decided by the layer sequencer. The only
adapter that gets mocked wholesale is analytics; everything else talks to the real test database
through `TestHarness`, which also provides `createTestUser` and supertest verbs that carry a
session.

## Known debt

`src/common/modules/databricks/databricks.adapter.ts` is 1,711 lines and implements the Databricks
port for three domains at once, importing row types from `experiments/core`, `iot/core` and
`metrics/core`. That is rule 11 broken in the largest file in the app, and its spec is longer still.
Splitting it per domain is the fix. Needs a ticket.

Three use-case files keep helpers at file scope instead of as private methods, against rule 2:
`get-iot-fleet-monitoring.ts` has one above the class, and `list-experiment-devices.ts` has two
below it. Move them onto the class next time either file is open. No ticket.

`OrganizationEmailPort` is named for its domain rather than its capability, which rule 4 says not to
do. Every other port in the app follows the convention, so this one is a rename. No ticket.

Ports are declared two ways. Most are an interface plus a Symbol, but `CachePort` in three domains
and `LambdaPort` in macros are abstract classes. Both work with Nest's injector and neither is
wrong, but a reader has to notice which they are looking at. Settle on the interface form when one
of them is next touched. No ticket.

`src/common/utils/` holds 26 files that mix genuinely generic helpers, such as `fp-utils.ts` and
`pagination.ts`, with domain vocabulary, such as `access-wording.ts`, `owning-organization.ts` and
`resource-access-scope.ts`. The domain ones belong in the domain that speaks that language. Add
nothing to this directory, and move an item out when you touch it. No ticket.

Four migration-shaped specs sit at the root of `organizations/` rather than in a layer, so the
sequencer classifies them only by the `/organizations/` fallback. No ticket.

`test/app.e2e-spec.ts` and `test/jest-e2e.json` are a Jest harness nothing runs any more. Delete
them. No ticket.

Rule 3 is currently kept: no use case in the app holds a mutable field.

## Decisions

- 2026-09-21. Rule 4 keeps the capability-first port name even though it means four interfaces
  called `DatabricksPort`, because the alternative is a domain prefix on every port in the app to
  solve a collision that only appears in one adapter.
- 2026-09-21. Rule 10 accepts two repository styles rather than forcing one. The Databricks side
  cannot use drizzle, and pretending otherwise would mean a fake abstraction over two databases
  that behave differently.
- 2026-09-21. `create-experiment.ts` stays the exemplar despite its two guards and its narrating
  comments, because its structure is right and a document that only points at perfect code has
  nothing to point at.
