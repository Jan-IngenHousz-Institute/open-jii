# Spike: workbook → dynamic XState machine

**Question:** can we pass an openJII workbook *as-is* (the persisted cell array) into
XState v5 and get a state machine that drives the measurement flow — replacing the
hand-rolled engine (mobile's Zustand store + `evaluate-and-route` + per-node-type
components, and web's `useWorkbookExecution`)?

**Answer from this spike: yes, cleanly.** The model maps onto XState almost 1:1, and the
branch-routing semantics can be reused *verbatim* from production instead of
reimplemented. Typecheck, 5 vitest cases, and a headless demo all pass against real
`xstate@5`.

```bash
pnpm --filter @repo/spike-xstate-workbook demo        # headless run, prints the trace
pnpm --filter @repo/spike-xstate-workbook test        # vitest
pnpm --filter @repo/spike-xstate-workbook typecheck
```

## What it does

`buildWorkbookMachine(cells, runtime)` walks the workbook cell array and emits one
XState state per executable cell. The async side effects (device scan, macro execution)
are injected as `runtime` so the whole thing runs headless with no React / native / BLE.

The demo output (one actor, two readings — first low, then good):

```
md_intro → q_sunlight → proto_psii → macro_phi2 (Phi2 0.475)
         → branch → [Phi2 < 0.5] loop back →
         → proto_psii → macro_phi2 (Phi2 0.747, constructs a follow-up protocol)
         → macro_phi2__dispatch (runs it, @repo/iot: estimateMs 60)
         → branch → [default] continue → md_done → done
```

The loop-back was decided by the **production `evaluateBranch`**, and `Phi2` was
**genuinely computed by the macro** over each scan (`json.raw_fluorescence`) — the
noisy first reading yields `Phi2 0.475`, the clean rescan `0.747`. The macro also
reads the ctx namespace (`ctx.answers.q_sunlight`). Nothing is hardcoded; state
flows protocol → macro → branch.

## Macro executor (and macros that drive the flow)

A macro is not an opaque step — it is an executor that *passes things*. `runMacro`
(in `runtime.ts`) mirrors mobile's `executeMacro`: it runs the macro body (resolved
from a `macroId` registry) with the upstream scan sample as `json` plus a `ctx`
namespace (`{ answers, outputs }`) of everything produced so far, and returns
`{ ...derived, messages }`. The spike runs JS macros directly (`new Function`);
python/R would route to `apps/macro-sandbox`. Output lands in `context.outputs` and
feeds downstream branches and macros.

A macro can also **construct a protocol and hand it back** under a `__dispatch`
envelope (the spike's stand-in for the real constructor-builder contract). When it
does, the macro's `onDone` is guarded (`macroProducedDispatch`) and fires an
explicit named action — **`dispatchConstructedProtocol`** (in the `setup({ actions })`
block) — which `spawnChild`s the `runProtocol` actor on the constructed protocol.
The generated `<macroCellId>__dispatch` state then awaits that spawned child's done
event and folds the result in, with the protocol **validated and inspected by the
real `@repo/iot`** (`estimateProtocolDurationMs`, `protocolRequiresInteraction`),
before continuing. So dispatch is a visible action, and a macro can decide *what
runs next*, not just feed a branch. In the demo the good reading constructs a
confirmation scan and the machine dispatches it (estimate 60 ms) before finishing.

> Actions vs actors: synchronous, fire-and-forget effects are **actions**
> (`setup({ actions })`); awaited async work whose result flows back is an
> **actor** (`setup({ actors })`, run via `invoke` or `spawnChild`). Running a
> scan/macro is an actor; *launching* the constructed-protocol dispatch is an
> action that spawns one.

## The mapping

| openJII concept | XState v5 construct |
|---|---|
| Workbook cell array (the "snapshot") | source the `states` config is generated from |
| `protocol` cell → `measurement` node | state that `invoke`s `runProtocol` (a `fromPromise` actor) with the ctx; `onDone` → `context.outputs[cellId]`, `onError` → error state |
| `macro` cell → `analysis` node | state that `invoke`s `runMacro` — a **real executor**: it receives the nearest upstream scan as `json` + the ctx namespace, runs the macro code, and writes `{...derived, messages}` to `context.outputs[cellId]` |
| macro returns a constructed protocol (`__dispatch`) | guarded `onDone` fires the `dispatchConstructedProtocol` **action** (`enqueueActions` + `spawnChild` of `runProtocol`); the `<cellId>__dispatch` state awaits the spawned child's done event and folds in the result (validated via `@repo/iot`) — the macro drives what runs next |
| `question` cell | state that waits for an `ANSWER` event (guarded by `eventCellIs`); `assign` → `context.answers[cellId]` |
| `markdown` cell → `instruction` node | state that waits for a `NEXT` event |
| `branch` cell | eventless (`always`) guarded transitions, one per reachable `gotoCellId` in path order, + an unguarded sequential fall-through |
| branch conditions (`eq/neq/gt/lt/gte/lte`, AND-across-conditions, first-match-then-`defaultPathId`) | reused verbatim via `@repo/api/utils/evaluate-branch` inside the `branchRoutesTo` guard |
| branch goto-loop cap (`MAX_BRANCH_VISITS`) | `context.visits[branchId]` + guard short-circuit |
| `output` cell | no state; folded into `context.outputs` and re-hydrated onto the cells before each branch eval (mobile's `hydrateCells`) |
| accumulated answers + results (the implicit "ctx namespace") | `context.answers` / `context.outputs`, keyed by cell id |
| runtime flow state | XState **persisted snapshot** — `actor.getPersistedSnapshot()`, JSON-serializable, restored via `createActor(machine, { snapshot })` |

## Files

- `src/workbook-machine.ts` — `buildWorkbookMachine(cells, runtime)`: the `setup()` block
  (typed actions/guards/actors) + the data-driven `states` generator.
- `src/flow-utils.ts` — pure helpers: executable-cell ordering, sequential `nextStateId`,
  goto resolution, `hydrateCells`.
- `src/runtime.ts` — the injectable `WorkbookRuntime` (real = BLE scan + macro sandbox;
  here a deterministic mock).
- `src/sample-workbook.ts` — a real workbook snapshot (every cell type + a loop-back
  branch), validated with the production `zWorkbookCellArray`.
- `src/run-demo.ts` — headless runner + a persist/restore round-trip.
- `src/workbook-machine.test.ts` — happy path, loop-back, context accumulation, event
  targeting, snapshot round-trip.

## Findings & risks (for a real implementation)

1. **Branch conditions are NOT in the derived flow graph.** `cells-to-flow.ts` keeps only
   path *summaries* (`{id,label,color}`) on the branch node — the `conditions` live only on
   the workbook `BranchCell`. So the machine must carry the original cells (it does, in
   `context.cells`) and evaluate branches against them, not against the flow graph. This is
   the single most important structural fact for anyone wiring this up.
2. **Hydration is required before branch eval.** `evaluateBranch` reads `question.answer`
   and `output.data` off the cells, so runtime answers/outputs must be folded back onto a
   cell copy first (`hydrateCells`). Identical to mobile today.
3. **Reuse is the win.** Routing, operators, default-path, and AND-semantics come straight
   from `@repo/api` — zero reimplementation, so behaviour can't drift from the current
   engine. This is the strongest argument for the approach.
4. **Persisted snapshots come for free** and are JSON — directly useful for the offline /
   resume story (cf. the offline scan-error work).
5. **Dynamic-config typing.** Because the `states` object is generated from data, it's typed
   loosely (`any`) where it's assembled; `context`/events/guards/actors stay fully typed via
   `setup()`. A production version would want either a typed builder or generated types.
6. **Not modelled here (deliberately):** back-navigation (mobile's `recordBranchJump` unwind),
   explicit repeat-N iteration, question `required` validation, and streaming scan progress
   (a real `runProtocol` would be `fromCallback` with `onSnapshot` for live progress). All fit
   XState; they're just out of scope for a feasibility spike.

## Open questions

- **Where would the machine live?** Today web and mobile each have their own runner. A single
  machine in a shared package (e.g. `@repo/api` or a new `@repo/workbook-runtime`) consumed by
  both, with `@xstate/react` `useSelector` on each side, would unify them.
- How does the persisted snapshot interact with the offline protocol precache?
