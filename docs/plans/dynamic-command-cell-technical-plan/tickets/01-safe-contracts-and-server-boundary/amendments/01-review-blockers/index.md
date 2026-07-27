---
title: "Close ticket 1 compatibility and preservation blockers"
kind: ticket
status: 2
---

# Close ticket 1 compatibility and preservation blockers

## Why this amendment exists

Independent review found that the initial ticket-1 implementation was not safe to accept. The user approved closing all findings inside one amendment before ticket 2 begins.

Parent: [Establish safe dynamic-command contracts and the server boundary](../../index.md)

## Required fixes

### 1. Cover the public experiment-flow API

- Add shared ref detection for flow graphs.
- Keep direct public `createFlow`/`updateFlow` authoring static-only while the dynamic publication gate is disabled; reject ref graphs before persistence with a stable code.
- If internally materialized workbook flows may contain refs, distinguish that trusted path from public flow authoring rather than bypassing the gate generically.
- Apply the same `dynamic-command-ref-v1` capability check to `getFlow` and return HTTP 426 before serializing a graph containing refs.
- Add direct create/update/get flow tests for missing/present capability and prove repositories are not called on rejection.

### 2. Make branch conversion bidirectionally lossless

- Reconstruct branch workbook cells from branch-node content and outgoing edges/source handles.
- Preserve path ids, labels, colors, default path, and goto targets required by the authored branch representation.
- Preserve conditions by extending the flow carrier if the existing summary cannot round-trip them.
- Add cells → flow → cells and flow → cells → flow tests containing a dynamic command, branch, sequential edge, and goto/loop edge.
- Remove the test caveat that deliberately excludes branches.

### 3. Reject mixed measurement carriers

- Make protocol and command flow content mutually exclusive.
- Reject protocol+ref, protocol+static-command, and static/ref mixed shapes before conversion.
- Preserve every valid legacy static command and protocol shape.
- Add schema and converter regression tests proving mixed shapes cannot be stripped or retyped.

### 4. Preserve loaded refs in the temporary web UI

- Replace the fabricated empty-static fallback with a non-editable reference summary until ticket 6 owns authoring.
- Disable static format/content mutations for refs and preserve the original payload on collapse, run, copy, and other supported interactions.
- Keep the existing execution no-device-call guard.
- Add component tests proving a loaded ref is visible, cannot be mutated to static, and retains its source/field.

### 5. Return sanitized structural issues in production

- Add an explicit production-safe public-details mechanism or allowlist for `WORKBOOK_STRUCTURAL_VALIDATION_FAILED`.
- Return sanitized issue code, command/source ids, field, and index; never expose command content, source output, or arbitrary error details.
- Keep production stripping for all non-allowlisted error details.
- Add production-mode HTTP tests for publish `{ issues }` and the 426 body, including stable code/message and absence of workbook cells/flow graph.

## Acceptance criteria

- Neither workbook-version nor public-flow APIs can persist or return dynamic refs outside the default-off gate/capability boundary.
- Internally materialized flows continue to support already-authorized workbook refs without reopening public authoring.
- Dynamic command and branch topology/conditions survive both conversion directions.
- All mixed protocol/command/ref carriers fail schema validation.
- A loaded ref cannot be silently converted or erased by the ticket-1 web fallback.
- Production callers receive only the sanitized repair details required by Core Flows.
- Existing static workbook, legacy experiment-flow, web command, and mobile flow behavior remains green.
- All rollout controls remain disabled.

## Verification

- Run focused API flow/schema/round-trip/validation tests.
- Run backend public flow CRUD/read, workbook publish/get-version, and controller HTTP tests in development and production-detail modes.
- Run web command-cell and flow-mapper tests plus web typecheck.
- Run mobile flow metadata/load tests plus mobile typecheck.
- Rerun `@repo/api` typecheck, backend build, affected lints, and `git diff --check`.

## Guardrails

- Do not start ticket 2 work.
- Do not enable backend publication, web authoring, or CMS rollout controls.
- Do not weaken exact ref preservation to accommodate the legacy flow API.
- Stop and report if lossless branch conditions require a product-visible schema change beyond the planned flow carrier.

## Closure review iteration 2

Independent re-review confirmed mixed-carrier rejection and the temporary web ref UI, but found three unresolved blockers:

1. Authored traversal must follow only the ordinary edge (`sourceHandle == null`). A forward branch goto must never become the linear successor or drop intervening cells. Tests must cover forward gotos, multiple paths, complete node order, the ordinary edge, every goto edge, conditions, and default path in both conversion directions.
2. Production repair details must be projected into a fixed public shape, not forwarded based only on the parent error code. Accept only known structural issue codes plus `commandCellId`, optional `sourceCellId`, `field`, and `index`; discard malformed shapes and all extra keys.
3. A gate-enabled public ref flow must pass structural validation before persistence. Validate source existence, eligibility, authored order, self/later references, and non-blank fields independently of the release gate; gate-off remains an earlier rejection. Tests must use a genuinely valid earlier source for success and prove every invalid shape performs no persistence.

## Closure review iteration 3

Final audit found that the flow validator remained fail-open for ref nodes omitted by the reverse converter. Close the interaction rather than adding another special case:

- Validate every ref-carrying flow node directly. Derive authored positions from the ordinary-edge chain, but never let conversion omission remove a ref from validation.
- Treat any ref command or referenced source outside one complete authored chain as structurally invalid; fail closed with an existing compatible issue or a dedicated graph-structure issue that is included in the sanitized public contract.
- Make reverse conversion preserve every schema-valid convertible node: traverse the ordinary chain first, then append unvisited nodes in deterministic original node-array order. Do not silently drop disconnected or goto-only nodes.
- Preserve ordinary-edge ordering for the authored chain and legacy edge-only goto reconstruction.
- Add gate-on create/update no-persistence tests for disconnected ref, goto-only ref target, and disconnected source. Add conversion tests with a present legacy goto-only target and assert full node retention/order.

## Closure review iteration 4

Adversarial review exposed a general graph-integrity gap. Close the boundary coherently rather than special-casing individual fixtures:

- The public flow graph schema must reject duplicate node ids and duplicate edge ids. The runtime validator must also fail closed on duplicates if invoked with unparsed data; identity maps may never rely on last-write-wins behavior.
- Bind every node type to its valid content carrier. A ref command must be a measurement command; a measurement source must be a valid protocol or command carrier; analysis must carry macro content; question/instruction/branch must carry their matching shapes. Preserve canonical legacy variants.
- Before authored-order checks for any dynamic graph, require one unambiguous ordinary-edge topology: no ordinary fork, merge/multiple predecessor, cycle, or dangling endpoint. The unique start-rooted ordinary chain is the sole order authority.
- Emit a sanitized structural issue for each affected ref when graph integrity makes authored order unknowable, and reject before public flow persistence.
- Add schema, shared-validator, and gate-on create/update no-persistence tests for both duplicate-id orderings, duplicate ref ids, type/content mismatch permutations, edge-order permutations, ordinary fork, merge, cycle, dangling edge, and valid canonical graphs.

## Closure review iteration 5

The topology boundary passed review; close the remaining wire and compatibility gaps around it:

- Make every server wire content carrier mutually exclusive and strict, including instruction, analysis, and branch. Mixed foreign keys such as a hidden `command` must be rejected before Zod can strip them. Keep runtime-only hydrated mobile content outside this wire schema.
- The defensive flow validator must recognize any raw ref carrier, require it to be a valid measurement-command node, and emit a sanitized invalid-carrier issue for wrong node types, mixed static/ref fields, or malformed ref carriers.
- Replace delimiter-concatenated converter edge ids with a typed collision-free encoding for sequential and goto edges. Existing persisted edge ids remain opaque and valid.
- Validate every cells-derived flow graph before trusted attach/set/upgrade persistence and return a controlled stable failure rather than storing an invalid graph.
- Add a controlled strict-read boundary for persisted flow rows. Historical type/content mismatches or duplicate identities must return a stable sanitized incompatibility error before controller response serialization; do not expose raw stored graph data.
- Add adversarial API/backend tests for mixed instruction/analysis/branch ref carriers, cast invalid ref nodes, collision-prone valid cell/path ids, trusted materialization, and GET of directly inserted historical mismatched/duplicate rows.

## Closure review iteration 6 — user-approved breaking boundary

The user explicitly approved a breaking strict boundary and asked execution to proceed. Do not preserve malformed historical flow shapes; retain only a controlled no-payload incompatibility response.

- Materialize and validate the target graph before mutation, then update the experiment workbook/version pointer and flow row atomically in one real database transaction for attach, upgrade, and set-version. Any pointer or flow failure must roll back both records.
- `materializeFlowGraph` must first strict-parse `unknown` cells with `zWorkbookCellArray`, convert only parsed cells, catch unexpected conversion failures, and strict-parse the derived graph. Malformed/mixed refs, missing payloads, and non-arrays fail without mutation.
- Public create/update use cases must strict-parse the full graph themselves before any flow repository access and persist only parsed data. Make node/path/condition envelopes strict where needed so misplaced ref-like keys cannot be stripped silently.
- Make raw dynamic-ref detection total over `unknown`; malformed stored rows must never throw before the controlled strict-read boundary. Capability refusal retains priority only when a ref can be inspected safely.
- Return the strict parsed graph after stored-flow read success. Incompatible legacy rows return the stable sanitized error with no graph payload; no backfill or compatibility transformation is required.
- Add real database rollback assertions for invalid materialization, forced pointer failure, and forced flow-upsert failure across all three binding paths, plus malformed-cell and malformed raw graph/controller tests.

## Closure review iteration 7 — complete atomic and strict perimeter

Apply the user-approved breaking boundary consistently to every supported workflow:

- Empty workbook materialization represents `no flow`. The atomic binder updates the pointer and deletes any existing flow row in the same transaction; successful GET then follows the existing not-found path rather than reading an invalid zero-node graph.
- Use the same transactional bind/unbind unit for attach, upgrade, set-version, detach, and project transfer. Project transfer must not independently create a flow and later link a workbook; materialize the published version and atomically bind it, returning the resulting flow id when successful.
- Prevent stale concurrent binding by conditionally updating or locking the experiment against the expected workbook id read by the use case. Conflict rolls back pointer and flow.
- Make workbook cell variants, branch paths/conditions, flow node/position, edge, and graph envelopes strict. Preserve arbitrary values only inside explicit data/params fields. Wrong-level `payload`, `command`, or `ref` keys must be rejected before stripping.
- Public create/update must strict-parse at the use-case boundary before detector/validation/repository access. Raw detection remains total for stored-read capability ordering.
- Map repository, driver, and arbitrary internal transaction failures to the fixed sanitized `FLOW_BIND_FAILED` public code/message. Preserve only explicitly safe binder-owned not-found/conflict errors; detailed causes remain server-side without payload logging.
- Add real database state assertions for empty attach/nonempty-to-empty upgrade/set, detach delete failure, project-transfer bind failure, stale expected-workbook conflict, and every second-write rollback, plus exact wrong-level schema/materialization/use-case tests.

## Closure review iteration 8 — final root and logging closure

- Make standalone `zExperimentFlowGraph` root-strict. Extract the graph fields and shared refinement so the public route uses a separate strict `{ id, nodes, edges }` input schema rather than intersecting a route id into a non-strict graph. Graph-root `command`, `ref`, `payload`, or any unknown key must be rejected by schema, direct use-case parsing, and HTTP handling before repository access.
- Binding failures may log only fixed metadata and a non-payload classification. Never log `Error.message`, AppError details, cells, graph, command, or source values. Add a sentinel logger-spy test.
- Lock the binder marker behavior with a spoof test: a repository-created AppError using a binder-owned safe code must still become sanitized `FLOW_BIND_FAILED`; only the private marker may preserve safe conflict/not-found output.
- Remove generated Graphify scratch data from the changeset.

## Final disposition

Accepted by independent review. No open findings remain; the parent ticket may proceed to its shared resolver dependency.
