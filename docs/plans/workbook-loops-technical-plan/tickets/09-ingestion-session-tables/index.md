---
title: "Ingest session provenance and route control records in centrum"
kind: ticket
status: 0
---

# Ingest session provenance and route control records in centrum

## Outcome

The centrum pipeline lands the new session fields as queryable columns and routes completion markers to a dedicated control table — batch/DLT-only work, no streaming yet.

## Governing context

- [Companion (rev 3)](../../loop-run-provenance-and-completeness/index.md) — leaf identity, ingestion routing
- Epic precedent: Ticket 8 column pattern (bronze `get_json_object` → silver null-cast fallback → gold/enriched passthrough)

## Included

- Bronze: top-level extraction of `workbook_session_id`, `iteration_path`, `loop_cell_path`, `loop_values` (mirroring Ticket 8's fields, not `parsed_data` struct evolution).
- Bronze routing: `record_kind = "workbook_session_complete"` rows → new `session_control` table (session id, manifest, version, completed_at, ingestion timestamp); control rows excluded from the measurement path.
- Silver: new columns with the null-cast legacy branch; imported/legacy rows yield nulls without error.
- Gold/enriched: passthrough wherever `workbook_run_id` flows today; durable leaf table exposes the full leaf key for the completeness layer (ticket 10).
- Every leaf/control row carries an explicit **ingestion timestamp** column (the processing-time anchor ticket 10's timers require).

## Explicitly out

- The streaming app, `sessions_ready`, `session_results`, supersede reconcile, backend endpoint (all ticket 10).

## Dependencies

Ticket 06 (field names/shapes fixed by the mobile payload).

## Acceptance criteria

- New columns present bronze→silver→gold/enriched; legacy rows null-safe end-to-end.
- Marker rows land only in `session_control`; zero control rows in measurement tables.
- `ast.parse`/pytest/pyright clean; existing pipeline regression tests green; `pipelines.reset.allowed:false` respected (no bronze reset required).

## Verification

`apps/data` pytest standalone (JAVA_HOME turbo caveat), ruff/pyright, structural column-chain inspection recorded on this ticket.

## Guardrails

No existing column contract changes; additive only. Leave statuses to the coordinator.
