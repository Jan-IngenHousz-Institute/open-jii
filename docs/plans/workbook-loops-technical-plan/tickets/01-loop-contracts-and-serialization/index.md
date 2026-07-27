---
title: "Establish loop contracts, additive serialization, and old-client safety"
kind: ticket
status: 0
---

# Establish loop contracts, additive serialization, and old-client safety

## Outcome

The single-level loop container exists as a persisted, validated, capability-gated contract in shared code and at the backend boundary — with proof that non-loop workbooks serialize byte-identically and old clients fail closed on loop graphs.

## Governing context

- [Technical plan (rev 3)](../../index.md) — decisions 2 & 3, compatibility & gating
- [Critique](../../critique/index.md) — B3 + N6 (guard sites scoped honestly)
- Epic precedent: dynamic-command ticket 01 (safe contracts and server boundary)

## Included

- Loop cell schema in `packages/api` (`zLoopCell` or equivalent): container with ordered body, `foreach` (literal list | question ref | Expression ref) and `repeat N` bounds, bound cap (default 1000), single-level only (validation rejects nested containers).
- Additive cells↔flow container encoding: non-loop workbooks byte-identical through cells→flow→cells; loop structure, body order, and bound survive round-trip (conversion tests per the epic's pattern).
- `flowGraphHasLoop()` content guard beside `flowGraphHasDynamicCommandRef()`.
- `workbook-loop-v1` capability; backend refusals extended: `get-workbook-version` 426 path and `get-flow` capability check refuse loop graphs to non-capable clients with no payload leak.
- Publish-time structural validation: well-formed single-level container; exactly one Processing step per workbook and it is terminal; no cross-iteration refs; no external refs into the body; branch targets stay within the body or exit to its end; Expression/Processing languages restricted to JS/Python; bound caps.
- Publish gate: loop graphs refused at create/update-flow and publish-version unless the loops publish switch is enabled (mirror `isDynamicCommandPublishEnabled`).

## Explicitly out

- Any runtime execution (tickets 04/05/08); authoring UI (07); mobile rehydration guard extension (05); nested-loop validation support.

## Dependencies

None (foundation).

## Acceptance criteria

- Old-client fixtures parse non-loop workbooks unchanged (byte-level serialization assertion).
- A loop graph fetched without `workbook-loop-v1` → 426, response body free of cells/bounds/body content.
- Every structural rule above has a rejecting test and a passing counterpart.
- Round-trip preserves container id, body order, bound form, and cap.
- All gates default-off; no rollout switch flipped.

## Verification

Focused suites in `packages/api` + backend workbooks/experiments suites (real test DB); typecheck + lint; record commands/results on this ticket.

## Guardrails

- Do not touch the shipped dynamic-command schemas' semantics.
- No silent-drop paths: unknown-to-old-clients content must be refused, never stripped.
- Leave artifact statuses to the coordinator.
