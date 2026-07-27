---
title: "Add the fan-in run mode across sandbox, mobile, and web runners"
kind: ticket
status: 0
---

# Add the fan-in run mode across sandbox, mobile, and web runners

## Outcome

One Processing-step script (JS or Python) runs identically over an ordered leaf array at every site: macro-sandbox Lambda, mobile on-device, web — with injected-global parity proven by a shared conformance fixture.

## Governing context

- [Technical plan (rev 3)](../../index.md) — execution model (critique B2 + N5)
- [Companion](../../loop-run-provenance-and-completeness/index.md) — fan-in input transport

## Included

- macro-sandbox: backward-compatible event `mode: "per-item" | "fan-in"` (absent = per-item); fan-in injects `leaves` (ordered array), `ctx`, `output`; single per-invocation budget replacing the 1s per-item cap; `{ input_ref }` S3-pointer input alternative with inline input below a size threshold; JS + Python wrappers (R deferred).
- Mobile runners: fan-in injection for the JS runner (`process-scan`-adjacent, not per-sample iteration) and the registered Python runner; fix the known drift — mobile JS gains the `output` global (and agreed baseline globals) to match Lambda.
- Web: fan-in invocation path via the existing `executeMacro` oRPC surface (mode threaded through) for the in-browser preview.
- Cross-run-site conformance fixture: one script + one leaf fixture executed against Lambda-JS, Lambda-Python, mobile-JS, mobile-Python, web — asserting identical results and identical available globals.

## Explicitly out

- Loop execution/collection of leaves (04/05/08); the backend session endpoint (10); R.

## Dependencies

None (parallel foundation).

## Acceptance criteria

- Existing per-item callers unchanged (no event-schema break; full sandbox regression suite green).
- Fan-in over N leaves returns one result; leaf order preserved as given.
- Input above the inline threshold routes via `input_ref` and produces identical results.
- A MultispeQ-style `output["x"] = …` script passes on all sites (drift fixed).
- Conformance fixture wired into CI for every runner it can reach; sites it cannot reach in CI are recorded.

## Verification

Sandbox integration tests (existing harness), mobile/web focused suites, conformance fixture results recorded on this ticket.

## Guardrails

Per-item semantics byte-for-byte unchanged; no relaxation of sandbox isolation (no new globals beyond the agreed parity set). Leave statuses to the coordinator.
