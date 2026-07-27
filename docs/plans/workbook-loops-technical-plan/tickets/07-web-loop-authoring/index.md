---
title: "Author loops on web behind the flag"
kind: ticket
status: 0
---

# Author loops on web behind the flag

## Outcome

Behind the `WORKBOOK_LOOPS` flag, a web author builds a loop workbook: a loop container with foreach/repeat bounds, Expressions and dynamic commands in the body, exactly one terminal Processing step — with repairable validation errors and no way to save an invalid graph silently.

## Governing context

- [Technical plan (rev 3)](../../index.md) — decision 3, compatibility (N6: web content guard is net-new)
- Epic precedent: dynamic-command ticket 06 (repairable authoring, structural-error UX)

## Included

- Loop container authoring UI in the workbook editor: create/delete container, reorder body cells, bound editor (literal list / question source / Expression source / repeat N with cap feedback); single-level enforced in UI + validation.
- Expression and Processing-step cells surfaced under the new names (ticket 02 vocabulary); language pickers restricted to JS/Python with R rejected inline.
- Structural validation UX: ticket 01's rules rendered as repairable, cell-anchored guidance (reuse the epic's `StructuralIssueList` + issue-key pattern); server rejections map by cell id, keep dialogs open, never auto-repair.
- Net-new web content guard: loop graphs from the API refuse-render on non-capable/flag-off paths beside the cells→flow conversion (fail closed, no partial canvas).
- Flag-off state: loop cells in an existing draft render locked (view/run-blocked, no delete), mirroring the epic's flag-off structural lock.
- i18n: all new strings via keys, en-US + de-DE parity.

## Explicitly out

- Web execution (08); publish-gate backend behavior (01); mobile anything.

## Dependencies

Tickets 01, 02.

## Acceptance criteria

- Flag off: no loop affordances; existing workbooks unaffected; a loop-bearing draft is locked, not corrupted.
- Flag on: author the canonical light-X/Y/Z workbook end-to-end; every ticket-01 structural rule surfaces as anchored, translated, repairable guidance.
- Attempted save/publish of an invalid loop graph is refused with mapped issues (no silent strip, no auto-delete).
- Locale coverage test extends to every new key (both locales).

## Verification

Focused component suites + full web suite; typecheck/lint; a11y roles on new error surfaces (alert semantics per the epic's pattern).

## Guardrails

Exact authored payloads never mutated by UI plumbing; no behavior change to non-loop authoring. Leave statuses to the coordinator.
