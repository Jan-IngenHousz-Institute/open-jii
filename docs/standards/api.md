# API contracts

`packages/api`, which is where the shape of every endpoint is defined. The web app builds its
client from it, the backend implements it, and the published OpenAPI document is generated from it.

How the backend implements a contract is [backend.md](backend.md), and the language rules are
[code.md](code.md).

## Read first

- `packages/api/src/contract.ts`, the aggregate router, and its header comment about why the shape
  is what it is.
- `packages/api/src/domains/experiment/experiment.contract.ts` and its schema file next to it.
- `packages/api/src/contract.spec.ts`, which is the guard that makes the aggregate trustworthy.

## Shape

One directory per domain, fourteen of them today, each holding a schema file and a contract file:

```text
src/
  contract.ts                      the aggregate router both sides import
  openapi.ts                       generates dist/openapi.json
  domains/<domain>/<domain>.schema.ts     the zod shapes
  domains/<domain>/<domain>.contract.ts   the procedures
  domains/experiment/<area>/              a sub-domain repeating the same pair
  shared/listing.ts, shared/errors.ts     pagination, scope, error shapes
  transforms/                             pure functions over contract types
  fixtures/                               corpora both sides test against
```

`experiment` is large enough to have nineteen entries of its own, one per area, each with the same
schema and contract pair. The aggregate spreads those sub-contracts into a single `experiments`
namespace so a caller writes `orpc.experiments.<endpoint>` without knowing how the files are
divided.

## Rules

1. A change starts here. Edit the contract, rebuild the package, then implement the backend and the
   web side against it. Doing it the other way round produces an endpoint whose real shape and
   published shape disagree. [review]
2. Schemas are named with a `z` prefix: `zExperiment` for the entity, `zCreateExperimentBody` for a
   request body, `zExperimentIdPathParam` for a path parameter, `zExperimentListResponse` for a
   response. The derived type is exported next to it. [review]
3. Ids are `z.string().uuid()`, timestamps are `z.string().datetime()` so the wire carries ISO
   strings, closed vocabularies are `z.enum([...])`, and query parameters use `z.coerce` because
   they arrive as strings. Put `.describe()` on a query field that needs explaining, since that text
   ends up in the OpenAPI document. [review]
4. A procedure declares its route explicitly:
   `oc.route({ method, path: "/api/v1/...", successStatus }).input(...).output(...)`. Paths are
   versioned and use braces for parameters. [review]
5. `transforms/` is for pure functions over contract types. No IO, no database, no framework
   imports, no knowledge of how either app stores anything. It exists so the web app and the
   backend share one implementation rather than two that drift. [review]
6. The package has no root entry point. Everything is reached through the subpaths in `exports`,
   which are `./contract`, `./domains/*`, `./shared/*`, `./transforms/*` and the fixtures file.
   [review]
7. Both consumers read the built output, so rebuild the package after changing it or you will debug
   a stale `dist`. [review]
8. Regenerate the OpenAPI document and sync the copies into `apps/docs` in the same change that
   alters a contract. CI regenerates and fails if the committed copies differ, so the commit has to
   contain them. [ci: docs_spec_drift]
9. Leave `contract.spec.ts` passing. It walks every procedure in the aggregate and asserts that each
   one has a route, that the method and success status are from the allowed sets, that no two
   procedures share a method and path, and that the domain key set matches an explicit list. A new
   domain means adding it to that list on purpose. [ci: Build, Lint, & Test]

## Patterns

**Adding an endpoint.** Write the input and output schemas in the domain's schema file, add the
procedure to the domain's contract file, add it to the aggregate if the domain is new, rebuild,
then implement the controller method and the client hook. The spec will tell you immediately if the
path collides with an existing one.

**Adding a sub-domain to experiment.** Copy one of the nineteen existing areas. Each is a directory
with a schema file and a contract file, and the aggregate spreads it into the `experiments`
namespace alongside the others.

**Sharing logic with the apps.** If both sides need the same conversion, it goes in `transforms/`
with a spec beside it and a fixture in `fixtures/` when the input is worth pinning. If only one side
needs it, it belongs in that app.

## Tests

Colocated `.spec.ts`, 43 files, running under the base vitest config in a node environment. The
interesting one is `contract.spec.ts`, which checks properties of the whole router rather than
examples of one procedure, so the guarantees hold for endpoints nobody thought to test.

## Known debt

`contract.spec.ts` reaches into oRPC's internal `"~orpc"` field through a locally declared interface
and a type assertion, which is rule 1 of [code.md](code.md) broken on purpose to get at something
the library does not expose. `apps/web/test/msw/mount.ts` reads the same field for the same reason,
so an oRPC upgrade can break the contract guard and the web test harness together, in two files
that look unrelated. Both work today. Worth a comment in each pointing at the other. No ticket.

`transforms/` has grown to 29 files and some of them carry real business logic rather than shape
conversion, including flow and workbook conversion, branch evaluation, MQTT topic construction and
column typing. Both apps now depend on this package for runtime behaviour and not only for types.
That is defensible for anything genuinely shared, but it means the contract package is on the
critical path of features, so keep an eye on anything landing here that only one app calls. No
ticket.

`domains/experiment/experiment.schema.ts` re-exports three sub-domain schema files with `export *`,
against rule 6 of [code.md](code.md). Importers could name those files directly. No ticket.

`shared/listing.ts` accepts two ways to ask for the same thing: the current `scope` parameter, and
an older `filter` that takes `member` or `my` and collapses to `related` whatever its value.
Removing `filter` means finding its callers first. No ticket.

## Decisions

- 2026-09-21. The contract's zod schema is the wire type and the backend's drizzle-zod schema is the
  persistence type, and they are maintained side by side on purpose. Computed read fields such as
  `organizationName` live on the backend model only, so adding a database column never changes the
  published API by accident. The cost is that a field wanted on the wire has to be added in both
  places, which is the trade we are making deliberately.
- 2026-09-21. The aggregate flattens the experiment sub-contracts into one `experiments` namespace
  rather than exposing the file structure, so the client surface does not churn when the files are
  reorganised.
