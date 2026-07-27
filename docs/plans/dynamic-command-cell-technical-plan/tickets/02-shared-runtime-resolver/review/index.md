---
title: "Review — ticket 2 shared runtime resolver"
kind: review
---

# Review: provenance-scoped dynamic command resolver (ticket 2)

**Verdict: ticket 2 is safe to complete.** The resolver is pure, host-neutral, fails closed, and its diagnostics never carry payload data. `@repo/api` typecheck is clean and all transform tests pass (14 files / 280 tests). No correctness blocker found. Tickets 3 and 5 may start in parallel, subject to the one adapter-mapping caution below.

Scope: `command-payload.ts`, `command-resolution.ts`, `runtime-output.ts`, `output-lookup.ts` (+ specs), checked against the ticket-1 schemas they build on (`command-source.schema.ts`, `workbook-cells.schema.ts`).

## What holds up (verified against the acceptance criteria)

| Criterion | Where | Status |
| --- | --- | --- |
| Static string/JSON/YAML byte-for-byte; throw→typed `STATIC_COMMAND_INVALID` | `command-payload.ts:99-105`, `24-50` | ✅ untrimmed string preserved; provider not called for static |
| Source exists / eligible / earlier; output cells excluded from authored index | `:114-125` | ✅ `filter(type!=="output")` before find + order check |
| Self / visually-later / goto-reached-first all rejected by authored order | `:121-125` | ✅ `sourceIndex >= commandIndex` → `COMMAND_SOURCE_NOT_EARLIER` |
| Loop reads latest same-epoch completion | provider called fresh each invocation | ✅ |
| Exact provenance equality; malformed/missing provenance never fresh | `runtime-output.ts:51-59,85-90`; `command-payload.ts:137-140` | ✅ `isRuntimeCellOutput` (which requires valid provenance) runs **before** `hasMatchingProvenance`, so malformed → `COMMAND_OUTPUT_INVALID`, never stale-passed |
| Shared resolves for every target; device only by exact id | `:143-167` | ✅ no `deviceId===undefined` fallback |
| Duplicate device ids, source-device error, error+data, undefined data | `:146-166` | ✅ dup scan first; `error!==undefined` beats data; `hasOwn(...,"data")` guards missing |
| No primary/display/other-device fallback; reconnect id pre-fails | `:154-159`, conflicting-scope rejected by strict `hasOnlyKeys` | ✅ device scope never reads a top-level `data` |
| Top-level field only; arrays/prototype rejected; non-string/whitespace typed; original string returned untrimmed | `:169-183` | ✅ `dataRecord` rejects arrays; `hasOwnProperty` blocks prototype chain |
| Diagnostics carry ids only — no resolved string, source data, device error, or adapter error | `command-resolution.ts:23-30`; sentinel tests | ✅ `SENTINEL_*` asserted absent in 4 tests |
| Host adapter throw / malformed / then-changing; purity/determinism | `:131-135`; no Date/random | ✅ throw→`COMMAND_OUTPUT_INVALID`, cause swallowed |
| Question adapter → shared `{ answer }` | `runtime-output.ts:93-98` | ✅ |
| Exported types/guards host-neutral, no cycle | `runtime-output.ts` (zero imports); type-only cross-imports erased | ✅ |

Static dispatch is **not regressed**: the diff is purely additive — `resolveInlineCommand`/`validateInlineCommand` signatures are unchanged, so the existing web (`useWorkbookExecution`) and mobile (`use-measurement-capture`, `command-node`) callers are unaffected.

## Findings

### 1. Integration caution for tickets 3/5 — strict envelope rejects a raw stored `OutputCell` (medium; not a ticket-2 defect)

`isRuntimeCellOutput` enforces `hasOnlyKeys` on both the output envelope and each device result:

- `runtime-output.ts:47-49` — device output allows only `{scope, provenance, deviceResults}`; device result allows only `{deviceId, deviceLabel, data, error}`.

But the ticket-1 stored `zOutputCell` / `zOutputDeviceResult` (`workbook-cells.schema.ts:102-126`) carry **more** keys: top-level `data` / `executionTime` / `messages`, and per-device `family` / `deviceName`. A host adapter in ticket 3/5 that forwards a persisted `OutputCell` (or its `deviceResults`) verbatim through `getRuntimeCellOutput` will be rejected by `hasOnlyKeys` and **silently pre-fail every dynamic command** with `COMMAND_OUTPUT_INVALID`.

This is by-design strictness, not a bug — but it is the single most likely wiring mistake downstream. **Tickets 3/5 must map `OutputCell` → `RuntimeCellOutput`** (set `scope` explicitly, drop `family`/`deviceName`/`executionTime`/`messages`, and route the single-device `data` into a `deviceResults` entry), never pass the stored shape through. Worth a one-line note in those tickets.

### 2. Duplicate cell ids are not detected; resolver relies on first-match (low; hardening)

`command-payload.ts:115,121-122` use `find`/`findIndex`, which silently pick the first cell with a matching id. `zWorkbookCellArray` (`workbook-cells.schema.ts:145-161`) validates only duplicate question **names**, not duplicate cell **ids**. If two live cells share an id, the resolver resolves against / orders by the first occurrence rather than reporting a conflict.

Low severity: this is a transient draft-only state, and publish→flow conversion catches duplicates that become node ids (ticket 1's graph superRefine). Self/later/goto ordering is handled correctly. No action required for ticket 2; flag only if a duplicate-id guard is wanted at the cell-array level later.

### 3. `record[field]` invokes an own getter (low; theoretical)

`command-payload.ts:171-175` — `hasOwn(record, field)` correctly blocks prototype-chain access (so `field: "toString"` etc. cannot pollute), but if arbitrary runtime `data` ever carried an **own** accessor property, reading `record[field]` would fire it, technically breaking purity. Realistic data is JSON-derived (plain values), so this is theoretical. Note only.

## Tests

Table-driven and negative-case-focused, not implementation mirrors: source-type × scope × provenance × device-state matrices, sentinel-leak assertions, loop-refresh, branch-skip, reconnect, conflicting-scope, authored-order-excludes-output. Solid coverage. One small gap: no explicit duplicate-cell-id case (finding 2), consistent with it being out of the resolver's remit.
