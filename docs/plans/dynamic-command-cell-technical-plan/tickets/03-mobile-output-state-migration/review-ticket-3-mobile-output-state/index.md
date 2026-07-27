---
title: "Review: mobile output-state migration (ticket 3)"
kind: review
---

# Review: mobile output-state migration (ticket 3)

Audit of the actual mobile diff against the technical plan (section 7), the core flows, and the completed resolver ticket (ticket 2). Scope: `apps/mobile` only. Web files (ticket 5) were not run or reviewed.

## Amendment re-review (F1 fixed — cleared to complete)

Amendment `amendments/01-normalized-macro-guard` fixes F1. `AnalysisNode.handleProcessed` now normalizes the macro output once (`normalizeMobileProducerData("macro", first)`) and compares that normalized candidate against the normalized registry entry, in both the single/shared and indexed multi-device paths; the raw `outputs` are untouched so `MacroMessages` still renders. Verified against the equality pitfalls:

- **Key-order / symmetry:** both sides derive from the same `first` via top-level rest-spread, so key order matches and the compare converges. The double normalization (`setMacroOutput` normalizes again) is idempotent — `withoutDisplayMetadata` strips four top-level keys that are already absent on the second pass.
- **Per-device merge order:** `mergeDeviceMacroOutput` appends in connect order and the guard blocks any re-write once a device's data is stored, so order is stable ([a, b]) with no flip-flop or loop.
- **Convergence, single + multi:** single path uses a stable callback (effect never re-fires → one write); multi path's fresh inline `onProcessed` re-fires the effect each render but the guard short-circuits → exactly one write per device. New test `converges messages-bearing multi-device writes…` asserts `setMacroOutput` called exactly twice, registry holds both devices' data without `messages`, and the raw `messages` still render and are unmutated.
- **undefined/empty:** `first === undefined` early-returns; scalar/empty outputs normalize harmlessly.

Checks (Node 22 sandbox): `pnpm --filter mobile typecheck` pass; `eslint` on the changed files pass; analysis-node 10/10 (incl. the new regression test); persistence/store/guard/hydrate/analysis 118/118. I did not independently reproduce the full 902-test run — the suite's `better-sqlite3` native binding fails under Node 22 (Node 24 unavailable here); that failure is environmental and unrelated to this change.

**Verdict: F1 resolved. The amendment and parent ticket 3 are safe to complete, and ticket 4 may begin once batch/dependencies allow.** F2 and F3 below were the remaining low items; F3 (test gap) is now closed by the new regression test. F2 remains an intentional, plan-aligned normalization and needs no action.

## Original verdict (superseded by the amendment above)

**Ticket 3 is NOT safe to complete as-is.** One high-severity regression (F1) breaks the ticket's headline scenario — per-device macro splits — whenever a macro emits a display field. It is a mechanical fix plus a regression test.

Everything else the ticket set out to do is implemented correctly and is well-tested: `outputsByCellId` is the sole resolver authority, provenance is version+epoch scoped and fails closed, the v1→v2 migrations use real serialized fixtures, the cross-store rehydration guard resets both stores on inconsistency, and **ticket 4 dynamic dispatch is not implemented** (no `resolveCommandPayload` / `getRuntimeCellOutput` call sites in mobile production code). Once F1 is fixed and covered, ticket 3 is safe to complete and **ticket 4 may start**.

## Findings

### F1 — Infinite render loop on multi-device macro output that carries a display field (HIGH)

`apps/mobile/.../flow-nodes/analysis-node/analysis-node.tsx:144`

The compare-before-set guard compares the **raw** macro output against the **normalized** stored value, but the store normalizes on write. `setMacroOutput` → `mergeDeviceMacroOutput` → `normalizeMobileProducerData("macro", …)` strips `messages`, `family`, `deviceName`, `executionTime` (`domain/runtime-output.ts:22`). So `existingData` (stored, stripped) can never equal `first` (raw, with those keys):

```ts
const existingData = /* read back from outputsByCellId — already stripped */;
if (existingData !== undefined && JSON.stringify(existingData) === JSON.stringify(first)) return; // never true when first has messages
setMacroOutput(nodeId, first, device); // writes again → re-render → repeat
```

**Failure scenario:** a multi-device workbook run where the macro emits any `messages` (info/warning/danger — a first-class, UI-rendered feature; `MacroOutput = MacroOutputMessages & Record<string, any>`, `process-scan.ts:10`). The multi-device branch passes a fresh inline `onProcessed={(outputs) => handleProcessed(outputs, index)}` every render (`analysis-node.tsx:279`), so `MeasurementResult`'s `useEffect([processedMeasurement, onProcessed])` (`measurement-result.tsx:64`) re-fires on each render. The write re-renders `AnalysisNode` (it subscribes to `outputsByCellId`) → new arrow → effect fires → guard fails → writes again → **"Maximum update depth exceeded"**, freezing the analysis screen mid-measurement.

This is a regression: the pre-ticket code stored the macro output **raw** (`setCellOutput`), so the compare was symmetric and converged. Normalization was moved to write time without updating the comparison.

The single-device path (`analysis-node.tsx:291`, stable `handleProcessed`) does not loop — its effect deps stay stable — but it still performs one redundant write. Both paths are wrong for the same reason.

**Fix:** compare against the normalized form, e.g. `normalizeMobileProducerData("macro", first)` on both sides of the equality (import the helper), or normalize `first` once and use it for both the compare and the `setMacroOutput` call. Then add a regression test (see F3).

### F2 — Protocol registry data is now the first sample only, not the sample array (LOW / confirm intent)

`apps/mobile/.../domain/runtime-output.ts:41`

`normalizeMobileProducerData("protocol", …)` returns `sample[0]` (a record). The prior `hydrateCells` normalization stored the whole `sample` array. This is required and correct for the resolver (`command-payload.ts:169` needs a record, not an array) and for branch evaluation (`resolveConditionValue` already unwrapped `[0]`, so field resolution is unchanged — verified by the migrated `hydrate-cells` tests). The only behavior change is that a downstream **macro** reading an upstream protocol's `ctx` now sees the first sample object instead of the full array. This matches the plan's top-level-record model; flagging only to confirm no multi-sample macro consumer depends on the array.

### F3 — Test gap that hides F1 (LOW, coverage)

`apps/mobile/.../analysis-node/analysis-node.test.tsx`

The producer-path tests use clean macro outputs (`{ chlorophyll: 42 }`), so the normalization no-op keeps the guard converging and the loop stays invisible. The store-level test does prove display-field stripping (`use-measurement-flow-store.test.ts`, "retains every producer …" asserts `messages`/`family` are dropped), but no analysis-node test exercises the **multi-device render with a `messages`-bearing output**. Add exactly that case; it will fail against the current code and pass after F1.

## Verified sound (no action)

| Area | Result |
| --- | --- |
| Sole authority | `outputsByCellId` is the only resolver/branch input; `hydrate-cells.ts` and `getRuntimeCellOutput` never read `scanResult(s)`/`producerCellId`/`cellOutputs`. Legacy scan fields persist only as upload/UI projections. |
| Scope correctness | Protocol/command are `device` scope even for one device; per-device macro merges every device via `mergeDeviceMacroOutput`; workbook-scope macro is `shared`; question adapts to shared `{ answer }` from the active iteration (`use-measurement-flow-store.ts:345`). |
| Normalization | `normalizeMobileProducerData` strips display-only fields before they enter the strict envelope; `isRuntimeCellOutput` rejects extra keys. |
| Provenance & lifecycle | Every entry carries `{ workbookVersionId, executionEpoch }`; new iteration / retry / reset / abandon / dismiss mint a new epoch and clear outputs+projections (`flow-transitions.ts` `clearedCycleOutputs`); resolution fails closed on mismatch. |
| Version/experiment reset | `setFlowGraph` is synchronous: same id → graph-only update preserves the cycle; different id/experiment → clears answers (`clearHistory`) then resets outputs/epoch/progress in one `set`. Empty/error load clears the graph via `setFlowNodes([])`. |
| Migration | `measurement-flow-storage` v1→v2 migrates macro `cellOutputs` (known producers only) and attributed scans **only when every entry has an exact device id**; ambiguous scans stay visible but non-resolvable; V0 → reset. `flow-answers-storage` v1→v2 identity migration preserves cycle answers. Fixtures are real serialized v1 envelopes run through `persist.rehydrate()`. |
| Rehydration guard | `installFlowRehydrationGuard` waits for both stores, is idempotent, and resets both on malformed/duplicate/stale/orphan state, surfacing `resume.invalidState` (present in both locales). |
| Ticket 4 boundary | No dynamic dispatch: `resolveCommandPayload` is unused in mobile; `command-node` still runs static inline commands; `getRuntimeCellOutput` exists only as the adapter boundary (ticket 3 scope). |

## Checks run

- `pnpm --filter mobile typecheck` — pass.
- Targeted vitest: persistence, store, rehydration-guard, flow-transitions, hydrate-cells, evaluate-and-route, analysis-node, load-experiment-flow — **all pass** (124 store/domain/persistence/guard/analysis tests). (Unrelated `better-sqlite3` native-module failures appear under the local Node 22 sandbox; Node 24 was not available here. tsc and the reviewed units are runtime-version-independent.)
