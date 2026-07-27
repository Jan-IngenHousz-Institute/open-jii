---
title: "Review: mobile dynamic command execution (ticket 4)"
kind: review
---

# Review: mobile dynamic command execution (ticket 4)

Cold review of the Codex implementation against Ticket 4, the technical plan (sections 4–7, 9), core flows, the shared Ticket 2 resolver, and completed Ticket 3 state/migration. Scope: `apps/mobile` dynamic dispatch plus the API resolver it consumes. No application files or statuses were edited.

## Amendment re-review — `01-preserve-command-projections-and-errors` (ACCEPT)

The amendment resolves the prior confirm-intent observations. Verified on current code:

- **Direct command projection restored.** `CommandNode.handleRun` builds a `projection: ScanResultEntry[]` from the *fulfilled* per-device outcomes and calls `setScanResults(projection, nodeId)` (command-node.tsx:171), so existing upload/analysis consumers get the reply back. `recordDeviceProducerOutcomes` (:172) still writes the registry. Resolution stays exclusively on `outputsByCellId`/`getRuntimeCellOutput` — the static path asserts `getRuntimeCellOutput` is never called.
- **Projection normalization matches convention.** Object (non-array) → as-is; scalar/array → `{ response: value }` — identical to the multi-scanner/web wrapping, consistent direct vs branch. Tests assert `"reply-a"` → `{ response: "reply-a" }` and object replies pass through.
- **Partial failure is safe.** Only successful devices enter the projection (failures excluded → no failure upload); failed devices are recorded as `error: "COMMAND_EXECUTION_FAILED"` (a code, not raw), and tests assert `raw-transport-secret` never reaches logs.
- **Multi-scanner metadata scoped correctly.** `producerCellId`/`producerKind`/`wasDispatched` are attached only to successes/failures whose assignment carries both fields; `executeScanAll` broadcast assignments (`{ device, command }`) lack them, so ordinary protocol/broadcast success/failure shapes are returned unchanged. Pre-failures are `push`ed after the enrichment map, so they never gain metadata.
- **Branch transport failures attributed.** The round handler records `round.failures` with `wasDispatched && producerKind === "command" && producerCellId` under the exact command producer/device as `error`, so a later ref yields `SOURCE_DEVICE_FAILED`. Resolver pre-failures (no `wasDispatched`) are skipped and stay non-executions with no output. Success and failure device sets are disjoint, so the two `recordDeviceProducerOutcomes` calls merge without misattribution or duplicates.

Checks: `pnpm --filter mobile typecheck` ✓, `pnpm --filter @repo/api typecheck` ✓, eslint on all changed mobile files ✓, affected suites (command-node, use-measurement-capture, use-multi-scanner, measurement-flow-store, analysis-node, hydrate-cells) 6 files/110 tests ✓. The resolver (`packages/api`) is untouched by this amendment.

**Minor, non-blocking:** the direct path passes `setScanResults(projection, nodeId)` (:171) while the branch path deliberately passes `undefined` (:222) to keep the projection display-only. Passing `nodeId` makes `setScanResults` also write a success-only `outputsByCellId[nodeId]` for one synchronous instant before `recordDeviceProducerOutcomes` overwrites it with the authoritative (errors-included) entry. Net authority is correct because the two calls are always paired and synchronous, but for consistency with the stated "no projection is device-scope authority" invariant, passing `undefined` here too would let `record` be the sole registry writer. Also: on an all-fail direct run, `setScanResults([], nodeId)` clears `scanResult`/`scanResults` — harmless since the node shows no Continue and can't advance, but it differs from `main` (which left the prior projection). Both are cleanups, not defects.

## Original verdict: ACCEPT

Ticket 4 is safe to complete. Every acceptance criterion and guardrail is met, verified against the diff and the tests. One deliberate behavior change (direct-command upload projection dropped) is worth a one-line confirm-intent, not a blocker. *(Superseded: the dropped projection is now restored by the amendment above.)*

## Audit results

| Concern | Result |
| --- | --- |
| Ref carrier survives load/hydration | `cells-to-flow` emits `{ command: { kind: "ref", ref } }`; `hydrate-flow-nodes` matches neither protocol nor macro branch for a command node and returns it unchanged → carrier preserved. `active-state` renders `CommandNode` for `content.command && !isDispatchTarget`, else `MeasurementNode`. |
| Resolve from raw cell + T3 adapter, once per target | `resolveMobileCommand` locates the `CommandCell` in `cells` and delegates exactly once to `resolveCommandPayload` with the store's `getRuntimeCellOutput`. It never reads or rewrites the flow-node carrier. Direct path loops per connected device; branch path resolves once per planned assignment. |
| Exact device ids + shared question fanout | Resolver requires one exact successful `deviceId` for `scope:"device"`; question adapts to a shared `{ answer }` applied to every target. Tests cover both. |
| Invalid devices → zero transport, valid continue | `handleRun`/`executeScanAssignments` build assignments only for `resolved.ok`; failures become views/`prefailed` and never reach `executeCommandOn`/the executor. Early return when all invalid. |
| No primary/display/other-device fallback | Resolver returns typed failures, never substitutes. Tests assert no call on missing-exact-device, stale, branch-skipped, and source-error. |
| Branch grouping can't broadcast wrong commands | Each device runs its own per-device resolved payload; the `completeWithSuccesses` grouping only *records* outcomes, keyed by the producer each device actually ran (`producerCellId` threaded through `ScanAssignment` → success). |
| Replies/errors recorded under exact producer/device; chaining | `recordDeviceProducerOutcomes` → `mergeDeviceProducerOutput` writes device-scoped `data`/`error`, replacing same-device ids and keeping others. Offline-resume chaining test passes. |
| Previews/failures clear on provenance change | `useEffect([executionEpoch, workbookVersionId])` clears `deviceViews` (command node) and `commandDispatchPreviews` (capture). Test confirms preview vanishes on epoch change. |
| Reconnect / skipped / stale / source-error / offline v2 resume | Covered by resolver semantics and dedicated tests, incl. new-runtime-id reconnect → `DEVICE_OUTPUT_MISSING` with no transport. |
| Authored payload never mutated | Resolver only reads; no ref→static conversion; command node deep-equals the authored cell after run (asserted). |
| Safe telemetry | `commandFailureLogFields` logs only codes/ids/provenance; tests assert resolved strings and raw source/error data (`stale-secret`, `raw-driver-secret`) never appear in logs. |
| Translations actionable | All 18 resolution codes present in `en-US`; `nl-NL` at parity; messages are user-actionable. |
| Multi-scanner / partition | Command scalar replies wrapped to `{ response }` before `partitionScanOutcomes` (avoids the "Invalid result" failure path); `producerCellId`/`producerKind` threaded onto successes. Protocol/static paths unchanged. |
| Rollout flags untouched | `DYNAMIC_COMMAND_AUTHORING` defined default-`false`; publish kill switch gated on `DYNAMIC_COMMAND_PUBLISH_ENABLED !== "true"` (default-off); mobile runtime execution is not gated by any authoring/force-update flag. |

## Observation (confirm intent — not blocking)

**Direct standalone command replies are no longer added to the scan/upload projection.** In `main` the direct command node called `setScanResult(result, nodeId, device)`, so a command reply fed the upload/display projection ("uploads as a measurement, mirroring MeasurementNode"). The new `CommandNode` records only to the registry via `recordDeviceProducerOutcomes` (0 `setScanResult` calls). Downstream branch/reference reads still work (they read `outputsByCellId`, not `scanResult`). Upload is unaffected for protocol measurement nodes (`use-measurement-capture.ts:248`) and for branch dispatch, which still sets the combined projection (`:222`). So the only changed path is a *standalone, non-dispatched* command node: its reply is now reference-only and is not uploaded, and it no longer becomes the primary `scanResult` a following analysis node would read.

This is consistent with Ticket 4 redefining command replies as "device-scoped command-cell outputs for later references," and the tests were updated to match, so I read it as intentional. Flagging only so the owner confirms no authored `command → analysis/upload` flow depended on the old behavior. Related and even lower: the branch path records only successful outcomes, so a branch-dispatched producer's per-device transport failure leaves no registry entry (a later reference fails closed as `DEVICE_OUTPUT_MISSING` rather than `SOURCE_DEVICE_FAILED`) — still fail-closed, no fallback, purely a less-specific code.

## Checks run

- `pnpm --filter mobile typecheck` → pass. `pnpm --filter @repo/api typecheck` → pass.
- `eslint` on all changed mobile files → clean (the two unrelated full-lint baseline files are pre-existing and out of scope).
- Mobile suites (command-node, use-measurement-capture, use-multi-scanner, evaluate-and-route, hydrate-cells, use-load-experiment-flow, hydrate-flow-nodes, measurement-flow-store) → 8 files, 126 tests pass.
- API `src/transforms` (resolver, conversion, validation) → 14 files, 280 tests pass.
- Environment note: Node 24 was unavailable in the sandbox (ran Node 22); `tsc`/`eslint` and these units are runtime-version-independent. I did not run the full mobile suite — its `better-sqlite3` native binding fails to self-register under Node 22 (unrelated). Confirm the full `pnpm --filter mobile test` gate on a Node 24 runner.
