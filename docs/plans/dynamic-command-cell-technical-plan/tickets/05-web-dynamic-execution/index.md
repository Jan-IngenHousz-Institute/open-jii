---
title: "Execute dynamic command cells safely on web"
kind: ticket
status: 2
---

# Execute dynamic command cells safely on web

## Outcome

Web execution maintains a synchronous provenance-scoped producer registry and uses the shared resolver for manual, Run all, loop, and device-branch command dispatch.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), section 6
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), web freshness
- Depends on [ticket 1](../01-safe-contracts-and-server-boundary/index.md) and [ticket 2](../02-shared-runtime-resolver/index.md)

## Included

- Add a synchronous `runtimeOutputsByCellId` registry and active web execution epoch beside display state.
- Normalize protocol, command, macro, and question completions with explicit scope and provenance.
- Use `producedBy` lookup only as the display-cell bridge, never as freshness proof.
- Invalidate registry and resolved previews on mount, Clear outputs, start of Run all, authored design change, and workbook-version change.
- Preserve manual source → command composition while the design/epoch is unchanged.
- Resolve direct and branch-routed commands separately for each target connection.
- Convert resolution failures into rejected per-device outcomes while continuing valid devices.
- Record command replies for later refs and expose runtime-only resolved previews/errors.
- Add safe failure telemetry and duplicate/conflicting-output fail-closed behavior.

## Explicitly out

- Creating/editing a ref in the command-cell UI.
- Enabling the web authoring flag.
- Mobile state or execution.

## Primary surfaces

- `apps/web/hooks/workbook/useWorkbookExecution/useWorkbookExecution.ts`
- Web command/protocol transport assignment hooks
- Output insertion/lookup helpers and execution state
- Branch dispatcher and workbook draft editor preview plumbing

## Dependencies

Tickets 1 and 2.

## Acceptance criteria

- A manually executed fresh source can feed its command in the same unchanged session.
- Direct command execution before the source runs is blocked with no transport call.
- Run all starts a new epoch and succeeds in authored order.
- Clear, authored edits, and version changes invalidate; rendering/removing runtime output cells alone does not count as a design edit.
- Loop execution consumes the latest same-epoch producer result.
- Branch-routed device groups resolve per connection and preserve partial success.
- Shared question/macro values may fan out; device-scoped results require exact ids.
- Command replies become later sources and previews never mutate `payload`.
- Static command behavior and existing branch execution remain green.

## Verification

- Extend `useWorkbookExecution` tests for every invalidation trigger, manual composition, Run all, loop, and device-branch cases.
- Assert zero transport calls for resolution failures and correct per-device command payloads for successes.
- Add preview-clearing and command-output-as-source tests.
- Run `pnpm --filter web exec vitest run hooks/workbook/useWorkbookExecution` and `pnpm --filter web check-types`.

## Guardrails

- Keep the freshness registry synchronous so one execution step can feed the next without React timing races.
- Do not infer freshness from persisted/rendered output cells.
- Do not log resolved strings or source data.
- Normalize display `OutputCell` values into a new strict `RuntimeCellOutput`; never pass raw top-level primary data or display-only device metadata (`family`, `deviceName`, `executionTime`, `messages`) to the resolver adapter.
