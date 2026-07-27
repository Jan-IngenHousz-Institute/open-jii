---
title: "Execute loops in the web runner with the preview-only record"
kind: ticket
status: 0
---

# Execute loops in the web runner with the preview-only record

## Outcome

`useWorkbookExecution` interprets loop workbooks: per-iteration body execution with scoped epoch/registry resets, in-memory leaf collection, and the terminal Processing preview — explicitly preview-only (web produces no authoritative record in v1).

## Governing context

- [Technical plan (rev 3)](../../index.md) — host parity (web executes, mobile records), decision 2
- [Shared semantics](../04-shared-loop-semantics/index.md)

## Included

- Loop interpreter in `useWorkbookExecution` driven by the shared transforms (ticket 04): realize bound, iterate body in order, inject `$loop`, per-iteration registry/epoch scoping for body cells (design-key/epoch machinery reused, scoped not global), sparse leaves on branch skip.
- Expressions execute per iteration via the existing macro execution path in per-item mode; dynamic commands resolve per iteration under the unchanged resolver contract; per-device assignment/preview behavior inside iterations preserved.
- In-memory leaf collection per run; terminal Processing step via fan-in (ticket 03) over collected leaves; result rendered as **preview** with the preliminary label; failure non-blocking.
- Run-invalidation semantics: workbook change/epoch invalidation mid-loop aborts cleanly (captured-token pattern), no partial leaves leak across runs.

## Explicitly out

- Web upload/ingestion path (out of v1); authoring (07); session ids in any web payload.

## Dependencies

Tickets 03, 04, 07.

## Acceptance criteria

- Canonical light-X/Y/Z workbook runs end-to-end in the browser with two simulated devices: exact per-device values per iteration, isolation preserved, preview computed over all leaves.
- Mid-loop invalidation (design change) yields zero further transport and a clean reset (extends the epic's invalidation tests).
- Sparse-leaf and Expression-computed-bound runs behave per shared-semantics tests.
- Non-loop web execution regression-green (full suite).

## Verification

Focused `useWorkbookExecution` suites + full web suite on Node 24; typecheck/lint; record results.

## Guardrails

Resolver contract untouched; no output-cell shape regressions (device identity enrichment from main preserved). Leave statuses to the coordinator.
