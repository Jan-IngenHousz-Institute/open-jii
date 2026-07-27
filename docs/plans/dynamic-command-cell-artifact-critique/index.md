---
title: "Dynamic command cells: adversarial artifact critique"
kind: review
---

# Dynamic command cells — artifact critique

Cold review of [core flows](../dynamic-command-cell-core-flows/index.md) and [technical plan](../dynamic-command-cell-technical-plan/index.md), grounded in the current codebase. No comments exist on either artifact.

**Verdict: Ready after specified revisions.** The architecture (shared pure resolver, additive union, per-device exact-match, force-update gate) is sound and fits the codebase. But three load-bearing claims are contradicted by the current code (F1–F3) and must be corrected before ticket breakdown — as written they would either drop the feature's own cell or leave a stale value reaching a device. F4–F5 are safety/rollout holes the plan asserts closed but the code leaves open.

The overall shape is worth keeping. The findings are corrections, not a redesign.

## Blockers — a stated claim is contradicted by the code

### F1. The round-trip claim is false: a reference command cell is silently dropped by `cellsToFlowGraph`

**Claim (tech plan, "Persisted command representation"):** *"`cellsToFlowGraph` and `flowNodesToWorkbookCells` round-trip both variants."* And ("Experiment flow serialization") *"must preserve the same static-or-reference command source."*

**What the code does.** `cellsToFlowGraph` builds a command node from `cell.payload.content`:

- `packages/api/src/transforms/cells-to-flow.ts:50-66` — `const source = cell.payload.name?.trim() ? cell.payload.name : cell.payload.content;` then `source.replace(...)`, and emits `content: { command: { format: cell.payload.format, content: cell.payload.content } }`.
- A `ReferencedCommandPayload` (`{ kind: "ref", ref }`) has **no `content` and no `format`**. `source` becomes `undefined`, `source.replace(...)` throws, and the `try/catch` at `cells-to-flow.ts:119-123` swallows it and `continue`s — **the node is dropped entirely.**
- The flow-node content schema itself has no field for a reference: `zExperimentMeasurementCommandContent` requires `content: z.string().min(1)` (`packages/api/src/domains/experiment/experiment.schema.ts:120-125`). The reverse converter `nodeToCell` (`flow-to-workbook-cells.ts:51-64`) only recognises a command when `typeof inline.content === "string"`, else falls through to a **protocol cell with `protocolId: undefined`**.

**Why this is the top finding — it breaks the feature on its primary target.** Mobile does **not** execute from the raw cells; `useLoadExperimentFlow` fetches the workbook version and derives the execution graph locally via `cellsToFlowGraph(cells)`, storing both (`apps/mobile/src/features/measurement-flow/hooks/use-load-experiment-flow.ts:51-57`). Dispatch then reads `content.command` off the flow node (`use-measurement-capture.ts` `resolveTargetPayload`, `command-node.tsx`), not off `cells`. So a dynamic command cell:

- **disappears from the mobile flow** (node dropped) — it never executes where the author placed it, directly violating the core-flows success criterion *"the command runs exactly where the author placed it."*
- **disappears from the web flow canvas / design view**, which also renders via `cellsToFlowGraph`.
- is **not preserved** across cells→flow→cells, falsifying the round-trip claim.

**What breaks first:** the moment a dynamic command reaches `cellsToFlowGraph` (mobile load, or the web flow view), the cell vanishes.

**Smallest correction:** the plan must own the flow-node reference carrier as an explicit deliverable, not a one-line assertion. Concretely: extend `zExperimentMeasurementCommandContent` with an optional `ref` variant, teach `cellToNode`/`nodeToCell` to map it (and stop dereferencing `.content` unconditionally), and specify that mobile dispatch resolves refs **from `cells` via the shared resolver** rather than from the derived flow-node content. State that old clients drop the ref node — which ties directly to F5.

### F2. Publish-time structural validation does not exist where the plan puts it

**Claim (tech plan, "Authoring and structural validation"):** *"Publishing a workbook version rejects these structural errors and returns actionable issue data."*

**What the code does.**

- `validateWorkbook` (`packages/api/src/transforms/validate-workbook.ts:61`) is **client-only** — its sole caller is the web upgrade dialog (`apps/web/components/workbook/upgrade/workbook-upgrade-dialog.tsx:124`). It has **no command-cell awareness** today (command cells are inline; the validator ignores them).
- The backend publish path `PublishVersionUseCase.execute` (`apps/backend/src/workbooks/application/use-cases/publish-version/publish-version.ts:26`) does **not** call `validateWorkbook`. It only runs Zod schema validation via `zWorkbookCellArray` on the version schema. There is no structural gate on publish.

So the guarantee "publishing rejects structural errors" is currently enforced by nothing. A workbook with a dangling/reordered dynamic-command reference could be published, then fail only at runtime — the opposite of the plan's intent.

**What breaks first:** any publish that doesn't route through the web upgrade dialog (API/mobile/other flows) ships a structurally-broken dynamic command with no rejection.

**Smallest correction:** name the enforcement point. Either wire the structural validator into `PublishVersionUseCase` server-side (preferred — it is the only path all clients share), or explicitly scope the guarantee to "the web publish dialog blocks" and accept that other publish paths rely on runtime failure. Also note the validator needs new command-reference codes added; today it has none for commands.

### F3. Mobile keeps per-device results for only one producer — the "any upstream + per-device" requirement is under-scoped

**Claim (tech plan, "Runtime output envelope"):** *"Mobile's current raw `cellOutputs` map becomes `Record<cellId, RuntimeCellOutput>` and records every producer... Mobile hydration continues to synthesize output cells, now without losing device-specific values."* Framed as: only the macro map needs broadening.

**What the code does.** Mobile has **two** separate output stores, and the measurement/command per-device results are single-slot:

- `cellOutputs: Record<string, unknown>` (`apps/mobile/src/features/measurement-flow/domain/flow-transitions.ts:62`) holds **macro/analysis outputs only**, latest value per cell, overwrite, **no per-device breakdown**.
- Measurement/command per-device results live in `scanResults: ScanResultEntry[]` + `scanResult` + a **singular** `producerCellId` (`flow-transitions.ts:52-59`). Only the **most recent** scan's per-device results are retained; `producerCellId` is one id.

So referencing an *earlier* protocol's or command's **per-device** output (the exact calibration case: protocol on device A and B → dynamic command per device) is not possible with the current store — the earlier producer's per-device results are gone the moment the next scan runs. This is not "just broaden the macro map"; it requires restructuring the singular `producerCellId`/`scanResults` slot into a per-producer, per-device map. The plan's own hard invariant ("a device-specific source value is never substituted with another device's value") cannot hold if only the latest producer's device split survives.

**What breaks first:** a two-step per-device flow (measure → dynamic command) where any producer runs between the source and the command; the source's per-device split is already overwritten.

**Smallest correction:** state explicitly that mobile must retain per-device results **per producer cell** (not just the latest scan), and that both `cellOutputs` *and* the `scanResults`/`producerCellId` structure fold into the per-producer `RuntimeCellOutput` map. This also changes the migration surface — see F7.

## High — a safety/rollout invariant the plan asserts but the code leaves open

### F4. Mobile does not clear outputs on workbook change — a stale value can reach a device

**Claim (tech plan, "Freshness / Mobile"):** *"An output present in the active cycle is fresh... Clear it on new iteration, retry, reset, workbook change, and flow abandonment."* Core-flows success criterion: *"A stale or missing value can never be silently sent to a device."*

**What the code does.** The workbook-change path is `setFlowGraph`, and it clears flow-step/branch state but **not** outputs: it does not reset `scanResult`, `scanResults`, `cellOutputs`, `iterationCount`, or `producerCellId` (`apps/mobile/.../stores/use-measurement-flow-store.ts` `setFlowGraph`; confirmed against `use-load-experiment-flow.ts:52-57`, which calls it on every `workbookVersionId` change). New-iteration/retry/reset/abandonment **do** clear outputs (`flow-transitions.ts` `startNewIterationState`/`retryIterationState`/`previousStepState`), but **workbook change is the gap the plan lists as covered.**

Because mobile freshness = "output present in the active cycle," a workbook upgrade mid-session leaves the prior version's outputs present and therefore "fresh," so a dynamic command could resolve against a stale upstream value from a different workbook version and dispatch it — the exact outcome both artifacts forbid.

**What breaks first:** a user upgrades the workbook version between measuring and running the dynamic command; the old per-device value is treated as fresh.

**Smallest correction:** require `setFlowGraph` (or a wrapper on version change) to clear `scanResult(s)`, `cellOutputs`, and `producerCellId`, or make the freshness authority key on `workbookVersionId` so outputs from a prior version are never fresh. Add this to the mobile clearing test list.

### F5. Rollout ordering is manual and the force-update gate is fail-open

**Claim (tech plan, "Compatibility and rollout"):** *"Release mobile runtime support first and set the existing force-update minimum version before enabling Dynamic authoring... Add a default-off web feature flag."*

**What the code does.** The two levers are independent and one fails open:

- The web authoring flag and the Contentful min-version gate are **decoupled** — nothing in code enforces "bump min-version *before* flipping the flag." A flag flip without the CMS bump immediately lets authors create refs that reach un-updated clients. (Flags: `packages/analytics/src/feature-flags.ts`; no command flag exists yet.)
- The force-update gate is **fail-open**: `useForceUpdateGate` returns "allowed" for `__DEV__`, on unparseable version, when Contentful creds are missing, and uses `networkMode: "offlineFirst"` with the last cached gate — a client that is offline or never fetched the gate is **not** blocked (`apps/mobile/src/features/force-update/hooks/use-force-update-gate.ts`, `domain/compare-version.ts:26-35`, `domain/gate-decision.ts`).

Combined with F1, an un-gated old client that receives a ref workbook drops the command node (best case) — but if the flow-node schema is tightened to carry a ref (the F1 fix), an old client parsing the new node against the old `min(1)` content schema could fail the **whole flow parse**, not just skip the node. That is worse than the "old apps drop it cleanly" property the existing command-cell design deliberately preserves (`workbook-cells.schema.ts:26-29`, `cells-to-flow.ts:51-52`).

**What breaks first:** the flag is enabled before the CMS min-version is bumped (or an offline old client), and an old build hits a ref node.

**Smallest correction:** make old-client behavior a design requirement of the F1 flow-node carrier — the ref node must remain droppable by old converters (do not tighten the old content schema in a way that fails the whole parse). Document that the rollout order is operationally enforced (a checklist / a server refusal to serve refs until min-version is set), and acknowledge the gate is fail-open so "old clients are forced to update" is a soft guarantee, not a hard one.

## Medium — decisions that need to be made explicit

### F6. Document-order precedence vs branch/goto execution order

Core-flows requires the source be *"earlier in the workbook"*; tech-plan resolver rule 2 is *"precedes in authored document order."* But execution follows edges and `gotoCellId` jumps (`cells-to-flow.ts:133-139`, web `resolveBranchJump`, mobile `evaluate-and-route.ts`), so runtime order ≠ document order in branchy flows. A source placed after the command but reached earlier via a goto would be rejected by the document-order rule despite being runtime-fresh; and the interaction of freshness + document-order in loops (`MAX_VISITS_PER_CELL = 100`) is unspecified. Decide whether precedence is document-order or execution-order, and say so.

### F7. Persisted-store migration is under-specified

Plan: *"Bump the persisted store version and migrate the previous raw macro-output map into `{ data: oldValue }` envelopes."* But (a) there are **two** persisted stores — `measurement-flow-storage` v1 and `flow-answers-storage` v1 — and only one is mentioned; (b) the existing `migrate` **discards** on version mismatch (`use-measurement-flow-store.ts:173-174`, answers store `:79-80`), which conflicts with "existing static flows retain resume behavior" unless the new migrate maps instead of discarding; (c) if F3's per-producer restructuring lands, the migration must cover the `scanResults`/`producerCellId` slot, not just `cellOutputs`. Spell out which stores bump, and whether a mid-cycle upgrade preserves or discards the active cycle (discarding is defensible — just decide it).

### F8. Dynamic dispatch is string-only — call it out as a functional limit

The resolver produces *"a non-empty command string"* and sends it raw. Static command cells support `json`/`yaml` structured protocols (`resolveInlineCommand`, `command-payload.ts`). So in v1 a device that needs a structured JSON/YAML payload **cannot** be driven dynamically — only string commands. This matches the stated "top-level string fields only" trade-off, but it is a user-visible capability gap (dynamic ⊊ static) that the core-flows should state so authors aren't surprised.

## Low — gaps worth a line each

- **F9. Question source in multi-device runs.** A question contributes a single `{ answer }` fanned identically to every device (it has no `deviceResults`). The per-device "never substitute another device's value" invariant doesn't apply — but the plan never blesses the shared-value case, and the field picker for a question source (only `answer` exists) is unspecified.
- **F10. Resolver→source-output linkage.** On web the source's output is a *separate* output cell keyed by `producedBy` (`useWorkbookExecution.ts` `insertOutputAfterCell`, `makeOutputCell`). The resolver signature takes `cells` but doesn't say how it locates the source's output cell (match `producedBy === sourceCellId`). Minor, but name it so the two hosts implement the same lookup.
- **F11. Device identity on reconnect.** Exact-device match keys on `Device.id` + connect order (`use-scanner-command-executor-store.ts`). A device that reconnects with a new id mid-cycle strands its earlier per-device output, so the dynamic command pre-fails that device — correct per the invariant, but a real calibration-interruption UX cliff worth a note in failure states.

## Cross-artifact consistency

No hard contradictions between the two artifacts. The tech plan **adds** publish-time validation and the rollout/flag machinery, which the core-flows does not mention — an expansion, not a conflict (and F2 shows that addition is not yet backed by code). The freshness split (web = session ledger, mobile = active cycle) is a faithful refinement of core-flows' "current session or cycle." The one place the tech plan quietly *weakens* a core-flows guarantee is the stale-value invariant, via F4 (mobile does not actually clear on workbook change) — that should be reconciled rather than left implicit.
