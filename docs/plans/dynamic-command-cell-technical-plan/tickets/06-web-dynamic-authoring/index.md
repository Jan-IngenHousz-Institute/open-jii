---
title: "Add repairable dynamic-command authoring behind the web flag"
kind: ticket
status: 2
---

# Add repairable dynamic-command authoring behind the web flag

## Outcome

Authors can configure, inspect, and repair dynamic references through the command cell, while creation/editing stays behind a conservative default-off flag and runtime support remains available for existing refs.

## Governing context

- [Ticket overview](../index.md)
- [Technical plan](../../index.md), authoring and rollout sections
- [Core Flows](../../../dynamic-command-cell-core-flows/index.md), authoring and validation
- Depends on [ticket 1](../01-safe-contracts-and-server-boundary/index.md) and [ticket 5](../05-web-dynamic-execution/index.md)

## Included

- Add the default-off dynamic-command authoring feature flag and conservative fallback.
- Add Static/Dynamic mode controls and explanatory tooltip to the command cell.
- Switching modes replaces the payload variant; no hidden static fallback is retained.
- Add an eligible earlier-source picker using authored order.
- Add top-level field suggestions from visible output plus manual entry; questions expose only `answer`.
- Render broken/deleted/reordered refs intact with repair guidance instead of dropping the cell.
- Display the latest resolved command, including a per-device list when values differ.
- Keep dynamic JSON/YAML, nested fields, and templates visibly unsupported in v1.
- Surface shared structural issues before publish and map backend publish details to the relevant command cells.
- Update sidebar/canvas/read-only representations for deterministic dynamic labels.
- Keep existing dynamic refs visible/runnable when authoring is disabled.

## Explicitly out

- Enabling the feature flag in production.
- Runtime resolver/transport work already owned by ticket 5.
- Mobile authoring.
- Templates, nested paths, or structured dynamic payloads.

## Primary surfaces

- `packages/analytics/src/feature-flags.ts` and web feature-flag plumbing
- `apps/web/components/workbook/cells/command-cell.tsx`
- Workbook cell renderer/sidebar/draft editor and field/source picker helpers
- Flow mapper/command panels and publish/upgrade validation UI
- Web translations and accessibility tests

## Dependencies

Tickets 1 and 5.

## Acceptance criteria

- The flag defaults off when analytics is unavailable.
- With the flag off, static authoring is unchanged and existing dynamic cells remain readable/runnable but not newly creatable/editable.
- With the flag on, mode switching persists exactly one strict variant.
- The source picker lists only eligible earlier protocol, command, macro, and question cells.
- Field suggestions are advisory; manual top-level names are supported.
- A broken ref remains diagnosable and repairable, and blocks publish with cell-level guidance.
- Question selection uses `answer` and clearly communicates shared multi-device behavior.
- Dynamic controls do not present JSON/YAML format selection.
- Resolved previews are runtime-only and clear with freshness invalidation.
- Static command component, sidebar, flow mapper, and publish tests remain green.

## Verification

- Add component tests for flag states, mode switching, source filtering, field suggestion/manual input, question behavior, broken refs, and read-only mode.
- Add publish-dialog tests using structured backend issues.
- Add flow canvas/sidebar tests proving a dynamic command remains visible and labeled.
- Run affected web tests, `pnpm --filter web check-types`, and analytics package type/tests.

## Guardrails

- Do not enable the flag as part of this ticket.
- Never auto-repair or delete a broken source id; preserve it for diagnosis.
- Do not autosave a resolved string into the authored payload.
