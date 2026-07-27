---
title: "Execute dynamic command cells safely on mobile"
kind: ticket
status: 2
---

# Execute dynamic command cells safely on mobile

## Outcome

Mobile retains and executes dynamic command nodes in their authored position, resolving direct and branch-routed assignments per device from the active-cycle registry.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), mobile integration and failure handling
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md)
- Depends on [ticket 1](../01-safe-contracts-and-server-boundary/index.md), [ticket 2](../02-shared-runtime-resolver/index.md), and [ticket 3](../03-mobile-output-state-migration/index.md)

## Included

- Update mobile flow-node types/hydration so the explicit ref carrier renders and never disappears.
- Resolve dynamic commands from the raw workbook cell plus the unified output adapter, not a duplicate flow-node resolver.
- Build direct-command assignments separately for every connected target device.
- Apply the same resolver to device-scoped branch dispatch plans.
- Pre-fail only invalid devices; continue valid assignments through the existing multi-scanner executor.
- Record command replies as device-scoped command-cell outputs for later references.
- Display resolved strings and typed actionable failures without mutating authored payloads.
- Handle shared question values, per-device producer errors, branch-skipped sources, stale provenance, and reconnect identity changes.
- Emit safe failure telemetry without resolved command text.

## Explicitly out

- Web authoring or web execution.
- Structured dynamic JSON/YAML.
- Enabling publication/authoring/force-update switches.

## Primary surfaces

- `use-load-experiment-flow.ts` and mobile flow-node/hydration types
- `use-measurement-capture.ts` assignment resolution
- Mobile `command-node.tsx`
- Branch routing/`evaluate-and-route` and device-plan handling
- Multi-scanner pre-failure integration and mobile translations

## Dependencies

Tickets 1, 2, and 3.

## Acceptance criteria

- A ref command remains present after workbook cells become the mobile flow graph.
- Direct execution resolves once per target and sends only valid assignments.
- Branch-routed devices use each target device's exact upstream value.
- A question answer intentionally supplies the same string to all targets.
- One device's missing/failed/stale value does not block valid devices and triggers no fallback.
- A reconnected device with a new id must rerun the source.
- The command response is available as that command cell's later source.
- Resolved preview/error state clears when the cycle provenance changes.
- Existing static command, protocol, branch, retry, offline-resume, and upload flows remain green.

## Verification

- Extend load-flow/hydration tests with a dynamic node.
- Add command-node and measurement-capture tests for direct, branch, partial success, shared value, exact match, reconnect, and no-device-call failures.
- Add an offline restart test that executes the dynamic command from migrated/current state.
- Run `pnpm --filter mobile typecheck` and the affected mobile test suites.

## Guardrails

- Mobile dispatch uses the shared resolver exactly once per assignment.
- No ref is converted into a static payload or written back to workbook cells.
- No failed resolution reaches `executeCommand`/`executeScanAssignments` as an assignment.
