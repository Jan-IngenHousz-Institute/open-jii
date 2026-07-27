---
title: "Define shared loop interpreter semantics and leaf identity"
kind: ticket
status: 0
---

# Define shared loop interpreter semantics and leaf identity

## Outcome

Both hosts interpret one loop contract from `packages/api`: iteration order, `ctx.$loop` shape, per-iteration resolver scoping, and the leaf identity/collection model — so mobile and web cannot drift (the epic's shared-resolver approach applied to loops).

## Governing context

- [Technical plan (rev 3)](../../index.md) — decisions 2 & 3, execution model
- [Companion](../../loop-run-provenance-and-completeness/index.md) — leaf identity

## Included

- Pure loop-iteration transform: bound realization (`foreach` list from literal/question/Expression output; `repeat N`), iteration order, `ctx.$loop = { value, index, name }` injection into the existing namespace builder.
- Per-iteration scoping contract: which state resets each iteration (registry entries for body cells, epoch semantics) and the loop-aware ordering rule (refs resolve earlier-within-same-iteration + before-loop; no external refs into the body) as pure helpers both hosts call.
- Leaf model: `Leaf = (workbook_session_id, iteration_path[], producer_cell_id, device_id_as_dispatched, loop_values, data, dispatch provenance)`; sparse-by-design collection semantics (branch-skip ⇒ no leaf); manifest derivation helper (leaf set → manifest entries) used by mobile (ticket 06) and by tests.
- `workbook_session_id` minting rule (once per run start, loop or not).

## Explicitly out

- Host wiring (05/08); upload payloads (06); any resolver behavior change (verified pure — stays pure).

## Dependencies

Ticket 01 (loop schema).

## Acceptance criteria

- Interpreter tests cover: foreach-from-question, Expression-computed list, repeat N, sparse leaves from branch skip, deterministic iteration order, `$loop` visibility inside body / absence outside.
- Ordering-rule helpers reject external→body refs and cross-iteration refs with typed codes (extending the epic's failure-code pattern + translations).
- Manifest derivation is a pure function of the leaf set (property test: manifest ↔ leaves bijection on keys).

## Verification

`packages/api` suites; typecheck; translation parity (en-US + de-DE) for new failure codes.

## Guardrails

`command-resolution.ts` remains pure and untouched in semantics; new codes only additive. Leave statuses to the coordinator.
