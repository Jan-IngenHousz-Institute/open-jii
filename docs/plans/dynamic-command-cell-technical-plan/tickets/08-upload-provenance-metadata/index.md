---
title: "Carry full command provenance in measurement uploads through MQTT to Databricks"
kind: ticket
status: 2
---

# Carry full command provenance in measurement uploads through MQTT to Databricks

## Outcome

Every measurement record that reaches Databricks (MQTT ingestion → centrum pipeline) carries complete metadata about what produced it: the producing workbook cell, the exact command dispatched to that device (static or dynamically resolved), the dynamic source reference, and the execution epoch — so downstream macro/analysis processing in Databricks never has to guess how a reading was obtained.

## User decision (recorded)

The dispatched command value is part of the scientific record and SHALL be included in uploaded experiment data. This does not change the epic's telemetry rule: logs/analytics still carry codes/ids/provenance only. Upload payload ≠ telemetry.

## Current state (verified)

- `apps/mobile/.../services/build-upload-payload.ts` already sends `workbook_run_id`, `workbook_version_id`, `macro_context` (JSON string of the device-scoped macro ctx).
- `apps/data/src/pipelines/centrum/silver/clean_data.py` extracts those into columns (lines ~62–64, 195–197) with null-cast legacy fallback (~247–249); `enriched/enriched_experiment_raw_data.py` passes `workbook_run_id` through.
- The capture site (`use-measurement-capture.ts`, `ScanAssignment`) knows `producerCellId`, `producerKind`, and the per-device `command` value at dispatch time — none of it reaches the payload.

## Included

- Mobile upload payload: add optional snake_case fields —
  - `producer_cell_id` (workbook cell that produced this measurement/reply)
  - `producer_kind` (`"protocol" | "command"`)
  - `dispatched_command` (the exact value sent to THIS device; JSON-stringify object commands)
  - `command_source` (dynamic only: JSON string of `{ sourceCellId, field }`; absent for static)
  - `execution_epoch` (the epoch the resolver validated against)
- Populate them for all upload paths that carry device data produced by a protocol/command: direct standalone command node, branch dispatch (per-device producer attribution already threaded), and protocol nodes (`producer_*` + epoch; no `dispatched_command`/`command_source` unless it is a command).
- Web host: check whether web execution uploads measurements into the same ingestion; if yes mirror the fields, if no record that finding in the ticket and skip.
- Databricks centrum pipeline: extract the new fields in `silver/clean_data.py` following the exact existing `workbook_run_id`/`macro_context` pattern, including the null-cast legacy branch; pass through to enriched/gold layers wherever `workbook_run_id` is passed today.
- Backward compatibility: all fields optional; absent fields → null columns; old records unaffected.
- Tests: `build-upload-payload` unit tests for every field/absence combination; capture-site tests asserting correct values for static command, dynamic command (exact per-device resolved value + source ref + epoch), shared question source, branch dispatch, and protocol; pipeline changes follow whatever test/verification convention exists in `apps/data` (if none, validate transform logic and record that).

## Explicitly out

- No change to logging/telemetry allowlists (codes/ids only — unchanged).
- No change to resolver, transport, or authoring behavior.
- No rollout switch changes; no schema registry/contract-breaking changes to existing columns.
- No Lambda macro-sandbox event schema change (macro ctx already covers Lambda-side needs; see walkthrough discussion).

## Acceptance criteria

- A dynamic command reply uploaded from mobile carries producer cell id/kind, the exact string that device received, `{sourceCellId, field}`, execution epoch, workbook run id, and workbook version id.
- A static command reply carries producer + dispatched command with no `command_source`.
- Two devices in one round upload their own distinct `dispatched_command` values.
- Protocol measurements carry producer identity + epoch and are otherwise unchanged.
- Silver layer exposes the new columns; legacy/absent-field records yield nulls without pipeline errors.
- No new field appears in telemetry/log output; existing log-safety tests stay green.
- Existing upload/pipeline regressions green; payloads remain valid for AWS IoT Core SQL parsing (new fields are small scalars, no compression impact).

## Verification

- Mobile: focused suites + full `pnpm --filter mobile test`, typecheck, lint on Node 24.
- Data: repo-conventional checks for `apps/data` (note the known turbo strict-env JAVA_HOME issue; run standalone if needed).
- Record exact commands/results in this ticket's evidence.

## Guardrails

- Do not weaken or bypass the exact-device/freshness resolver contract to obtain metadata — read what the capture site already has.
- Do not log dispatched command values anywhere.
- Leave artifact statuses for the coordinator.
