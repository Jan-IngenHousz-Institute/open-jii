---
title: "Execute loops on mobile with resume and the Processing preview"
kind: ticket
status: 0
---

# Execute loops on mobile with resume and the Processing preview

## Outcome

A field researcher runs a loop workbook offline on mobile: per-iteration Expression→command→measurement with the shipped safety contract intact, leaves collected and persisted, restart/resume mid-loop, and the Processing-step preview shown (labelled preliminary) at the end.

## Governing context

- [Technical plan (rev 3)](../../index.md) — host parity, field-preview honesty
- [Critique](../../critique/index.md) — B4 (new loop scope, not wrap-counter reuse), N6 (rehydration guard)

## Included

- New single-level loop scope state (loop cell id + iteration index + body-scoped clearing), explicitly NOT reusing the whole-flow `iterationCount` wrap counter; existing wrap/branch behavior outside loops unchanged.
- Per-iteration flow: `$loop` in ctx, Expressions run on-device (JS/Python), dynamic commands resolve per iteration under the unchanged resolver contract; branch-skip inside body produces sparse leaves.
- Leaf collection persisted per run (survives restart); resume restores loop position + leaves; malformed loop-resume state → the epic's coordinated reset path.
- `flow-rehydration-guard` extended with the `flowGraphHasLoop()` content check (fail closed on non-capable/stale state, covering offline resume where no capability re-check exists).
- Terminal Processing step runs locally via fan-in (ticket 03) over the collected leaves; result rendered as **preview** ("preliminary — final result computed after upload"); preview failure never blocks run completion.

## Explicitly out

- Upload fields/marker (06); nested loops; aggregate-driven branching; web (07/08).

## Dependencies

Tickets 02, 03, 04.

## Acceptance criteria

- Two-device loop: each device receives its own per-iteration computed command; cross-device isolation and fail-before-transport preserved (epic invariants re-asserted inside a loop).
- Kill/restart mid-iteration resumes at the correct iteration with prior leaves intact; version change or malformed state resets coordinately.
- Sparse-leaf run (branch skips iteration 2) completes and previews over the realized set.
- Preview labelled; preview script failure → run still completes, error surfaced non-blockingly.
- All shipped mobile regression suites green.

## Verification

Full `pnpm --filter mobile test` on Node 24 + focused loop suites; typecheck/lint; record results.

## Guardrails

Never weaken exact-device/freshness resolution to make loop dispatch work; no resolved values in logs. Leave statuses to the coordinator.
