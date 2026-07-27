---
title: "Reclassify macro roles: Expression and Processing step"
kind: ticket
status: 0
---

# Reclassify macro roles: Expression and Processing step

## Outcome

"Macro" is deprecated as a user-facing concept: the epic's analysis-feeding-a-command role is renamed **Expression**, the terminal post-process role becomes **Processing step**, and every layer that carries a producer-kind vocabulary reads legacy values forever.

## Governing context

- [Technical plan (rev 3)](../../index.md) — decision 1 + reclassification scope (critique D6)

## Included

- New producer kind `"expression"` added alongside existing values in: mobile `runtime-output.ts` (`MobileProducerKind`, `producerKindFor`), normalize/merge helpers, the upload `producer_kind` type, and the documented bronze/silver column vocabulary (data side reads both; no column migration).
- Node/cell role mapping at load time: legacy analysis-as-command-source payloads present as Expressions; stored data unchanged (read-legacy-forever, both directions tested).
- Processing-step cell role introduced in shared schemas (terminal, exactly-one enforced by ticket 01's validation).
- User-facing strings: authoring labels, docs vocabulary — "macro" survives only as the low-level script entity (`macroId`, macro-sandbox untouched).

## Explicitly out

- Any infra rename (macro-sandbox, `macroId`, endpoints); fan-in execution (03); authoring UI beyond labels (07).

## Dependencies

Ticket 01 (schema home for the Processing-step role).

## Acceptance criteria

- Legacy persisted flows/workbooks load and execute identically (regression suites green, zero data migration).
- New uploads may carry `producer_kind: "expression"`; pipeline accepts both old and new vocabularies with no null-outs.
- No user-visible "macro" remains on the loop/dynamic-command authoring surfaces (flag-on states).

## Verification

Mobile + web + api focused suites; a fixture pinning legacy `"macro"` producer_kind rows through silver.

## Guardrails

Read-legacy-forever is a hard rule — no rewrite-on-load of persisted payloads. Leave statuses to the coordinator.
