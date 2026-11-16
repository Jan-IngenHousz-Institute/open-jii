# API contracts

`packages/api`, which is where the shape of every endpoint is defined. The web and mobile apps
build their clients from it, the backend implements it, and the published OpenAPI document is
generated from it.

How the backend implements a contract is [backend.md](backend.md), and the language rules are
[code.md](code.md).

## Read first

- `packages/api/src/contract.ts`, the aggregate router, and its header comment about why the shape
  is what it is.
- `packages/api/src/domains/experiment/experiment.contract.ts` and its schema file next to it.
- `packages/api/src/contract.spec.ts`, which is the guard that makes the aggregate trustworthy.

## Shape

One directory per domain, sixteen of them today. Fourteen contribute a contract to the aggregate,
and each of those holds a contract file and, apart from `health`, a schema file beside it.
`authorization` and `visibility` hold shared schemas only:

```text
src/
  contract.ts                      the aggregate router both sides import
  openapi.ts                       generates dist/openapi.json
  domains/<domain>/<domain>.schema.ts     the zod shapes
  domains/<domain>/<domain>.contract.ts   the procedures
  domains/experiment/<area>/              a sub-domain repeating the same pair
  shared/listing.ts, shared/errors.ts     pagination, scope, error shapes
  transforms/                             pure functions over contract types
fixtures/macro-input-normalization.json   the one corpus both sides test against, outside src/
scripts/write-contract-routes.cjs         writes the routes-only contract copy the browser imports
```

`experiment` is large enough to have sixteen sub-directories of its own, one per area, each with
a schema file and a contract file except `workbooks`, which has only a contract. The aggregate
spreads those sub-contracts into a single `experiments` namespace so a caller writes
`orpc.experiments.<endpoint>` without knowing how the files are divided.

## Rules

1. A change starts here. Edit the contract, rebuild the package, then implement the backend and the
   web side against it. Doing it the other way round produces an endpoint whose real shape and
   published shape disagree. [review]
2. Schemas are named with a `z` prefix: `zExperiment` for the entity, `zCreateExperimentBody` for a
   request body, `zExperimentIdPathParam` for a path parameter, `zExperimentListResponse` for a
   response. The derived type is exported next to it. [review]
3. Ids are `z.string().guid()`, timestamps are `z.string().datetime()` so the wire carries ISO
   strings, closed vocabularies are `z.enum([...])`, and query parameters use `z.coerce` because
   they arrive as strings. Put `.describe()` on a query field that needs explaining, since that text
   ends up in the OpenAPI document. [review]
4. A procedure declares its route explicitly:
   `oc.route({ method, path: "/api/v1/...", successStatus }).input(...).output(...)`. Paths are
   versioned and use braces for parameters. [ci: Build, Lint, & Test]
5. `transforms/` is for pure functions over contract types. No IO, no database, no framework
   imports, no knowledge of how either app stores anything. It exists so the web app and the
   backend share one implementation rather than two that drift. [review]
6. The package has no root entry point. Everything is reached through the subpaths in `exports`,
   which are `./contract`, `./contract-routes`, `./domains/*`, `./shared/*`, `./transforms/*` and
   the one fixtures file. [review]
7. Every consumer reads the built output, so rebuild the package after changing it or you will
   debug a stale `dist`. [review]
8. Regenerate the OpenAPI document and sync the copies into `apps/docs` in the same change that
   alters a contract. CI regenerates and fails if the committed copies differ, so the commit has to
   contain them. [ci: Docs API Spec Drift Check]
9. Leave `contract.spec.ts` passing. It walks every procedure in the aggregate and asserts that each
   one has a route, that the method and success status are from the allowed sets, that it declares
   an output schema, that its path is absolute with balanced braces, that no two procedures share a
   method and path, that every route outside `/health` sits under `/api/v1/`, and that the domain
   key set matches an explicit list. A new domain means adding it to that list on purpose.
   [ci: Build, Lint, & Test]
10. Treat `asyncapi.yaml` as part of the contract layer. A field added to or dropped from the ingest
    schemas in `apps/data/src/lib/openjii/openjii/centrum/schemas.py`, or from the bronze raw data
    pipeline, changes `asyncapi.yaml` in the same pull request, and the copy in `apps/docs/public`
    is synced with it. [ci: Docs API Spec Drift Check]
11. A list procedure takes `scope`, `zListSort` with its own field allowlist, `zListFilter` for
    multi-value filters and `zPaginationQuery`. It returns an array when the request has no `page`
    and the `zPaginated` envelope when it has one, so the schema never defaults `page`. [review]
12. A new list procedure with `sort` needs an entry in the sort example list in `src/openapi.ts`,
    so the published document shows the bracket-indexed form the clients send and not oRPC's
    `deepObject` form. [review]

## Patterns

**Adding an endpoint.** Write the input and output schemas in the domain's schema file, add the
procedure to the domain's contract file, add it to the aggregate if the domain is new, rebuild,
then implement the controller method and the client hook. The spec will tell you immediately if the
path collides with an existing one.

**Adding a sub-domain to experiment.** Copy one of the sixteen existing areas, other than
`workbooks`. Each is a directory with a schema file and a contract file, and the aggregate spreads
it into the `experiments` namespace alongside the others.

**Sharing logic with the apps.** If both sides need the same conversion, it goes in `transforms/`
with a spec beside it and a fixture in `fixtures/` when the input is worth pinning. If only one side
needs it, it belongs in that app.

## Tests

Colocated `.spec.ts`, 54 files, running under the base vitest config in a node environment. The
interesting one is `contract.spec.ts`, which checks properties of the whole router rather than
examples of one procedure, so the guarantees hold for endpoints nobody thought to test.

## Known debt

`contract.spec.ts` reaches into oRPC's internal `"~orpc"` field through a locally declared interface
and a type assertion, which is rule 1 of [code.md](code.md) broken on purpose to get at something
the library does not expose. `apps/web/test/msw/mount.ts` reads the same field for the same reason.
`apps/backend/src/test/test-harness.ts` and
`apps/backend/src/common/modules/analytics/services/errors/orpc-error.interceptor.ts` read it too,
through the library's own types and with no assertion. An oRPC upgrade can therefore break the
contract guard, the web test harness, the backend test harness and the backend's error reporting
together, in four files that look unrelated. All work today. Worth a comment in each pointing at
the others. No ticket.

`transforms/` has grown to 18 modules and 17 specs, and some of the modules carry real business
logic rather than shape conversion, including flow and workbook conversion, branch evaluation, MQTT
topic construction, device connectivity and column typing. The backend, the web app and the mobile
app depend on this package for runtime behaviour and not only for types. That is defensible for
anything genuinely shared, but it means the contract package is on the critical path of features.
Three modules have a single consuming app today: `device-connectivity` and `flow-to-workbook-cells`
in the backend, and `validate-workbook` in the web app. They belong in that app. No ticket.

`domains/experiment/experiment.schema.ts` re-exports three sub-domain schema files with `export *`,
against rule 6 of [code.md](code.md). Importers could name those files directly. No ticket.

`shared/listing.ts` accepts two ways to ask for the same thing: the current `scope` parameter, and
an older `filter` that takes `member` or `my` and collapses to `related` whatever its value. The
experiment, macro, protocol and workbook list inputs still declare it, `resolveListScope` still
resolves it, and four web components under `apps/web/components/iot-devices/` still send
`filter: "member"`. Move them to `scope`, then remove the alias. No ticket.

`domains/protocol/protocol-validator.ts`, `domains/iot/device-profile.ts` and
`domains/experiment/visualizations/experiment-visualization-role-rules.ts` hold behaviour inside
domain folders, where the Shape above names only schemas and contracts. Put new behaviour that both
apps share in `transforms/` instead. No ticket.

`transforms/flow-to-workbook-cells.ts` has six type assertions and 15 more sit in schema and
transform files and in `src/openapi.ts`, against rule 1 of [code.md](code.md). Fix them in the
files you were editing anyway. No ticket.

The header comment in `src/contract.ts` names a predecessor library, against rule 13 of
[prose.md](prose.md). Describe what the aggregate does instead. No ticket.

## Decisions

- 2026-09-21. The contract's zod schema is the wire type and the backend's drizzle-zod schema is the
  persistence type, and they are maintained side by side on purpose. Computed read fields such as
  `organizationName` live on the backend model only, so adding a database column never changes the
  published API by accident. The cost is that a field wanted on the wire has to be added in both
  places, which is the trade we are making deliberately.
- 2026-09-21. The aggregate flattens the experiment sub-contracts into one `experiments` namespace
  rather than exposing the file structure, so the client surface does not churn when the files are
  reorganised.
- 2026-11-16. Reconciled with main, so the counts, the package layout, the rules and the debt lines
  follow the code as it stands.
