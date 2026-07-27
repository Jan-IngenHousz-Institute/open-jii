---
title: "Implement the provenance-scoped dynamic command resolver"
kind: ticket
status: 2
---

# Implement the provenance-scoped dynamic command resolver

## Outcome

Provide one pure shared resolution contract for web and mobile. It distinguishes shared from device-scoped outputs, enforces workbook/epoch provenance and authored order, and returns typed pre-dispatch failures.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), sections 3–5
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), execution, scope, and failure behavior
- Depends on [ticket 1](../01-safe-contracts-and-server-boundary/index.md)

## Included

- Add the discriminated `RuntimeCellOutput` and `OutputProvenance` shared types.
- Add the `findOutputCellByProducer`/`producedBy === sourceCellId` lookup rule and duplicate-output failure.
- Implement `resolveCommandPayload` for static and ref sources.
- Enforce authored document order while excluding output cells from the authored index.
- Adapt current-cycle question answers as shared `{ answer }` values.
- Resolve shared values for every target and device-scoped values only by exact `deviceId`.
- Enforce active workbook version and execution epoch.
- Require a top-level, non-empty string for dynamic v1.
- Return stable failure codes for all expected structural/runtime states.
- Reject duplicate device results, conflicting scope, source-device errors, and primary-data fallback.

## Explicitly out

- Host-owned registries, persistence, React state, transport, and previews.
- Dynamic JSON/YAML, nested paths, templates, or implicit Python dispatch.
- Device identity redesign; reconnects with a new id intentionally pre-fail.

## Primary surfaces

- `packages/api/src/transforms/command-payload.ts`
- New shared runtime-output, output-lookup, and resolution-result modules
- Existing workbook output-cell and device-context helpers

## Dependencies

Ticket 1.

## Acceptance criteria

- Static resolution remains byte-for-byte compatible for string, JSON, and YAML.
- Every eligible source type resolves when earlier, fresh, and valid.
- A visually later source is rejected even when branch/goto execution reached it first.
- A loop consumes the latest same-epoch completion of the earlier source.
- Shared question and macro values resolve identically for multiple targets.
- Device-scoped one-device and multi-device values require an exact match.
- Missing, failed, duplicated, or reconnected device identities never fall back to primary/other-device data.
- Prior version/epoch, absent output, missing field, non-string, and empty string return stable typed failures without throwing.
- Resolved command strings and raw source data are not included in diagnostic payloads.

## Verification

- Add table-driven shared tests spanning source type × scope × provenance × device state.
- Add authored-order, duplicate-output, branch-skip, loop-refresh, reconnect, and string-only cases.
- Run `pnpm --filter @repo/api exec vitest run src/transforms` and `pnpm --filter @repo/api typecheck`.

## Guardrails

- The resolver must remain pure and host-neutral.
- Display/primary output is never proof of freshness or a device fallback.
- Expected user failures are result values, not exceptions.

## Completion evidence

- Independent review accepted the resolver with no correctness blocker.
- Final implementation passed 1,431 API tests, API typecheck/build/lint, backend build, web/mobile typechecks, and `git diff --check`.
- Host adapters in tickets 3 and 5 must explicitly normalize richer stored/display output cells into the strict runtime envelope; raw output cells and raw device-result metadata must never be forwarded.
