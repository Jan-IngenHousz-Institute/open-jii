---
title: "Stamp session provenance on uploads and emit the completion marker"
kind: ticket
status: 0
---

# Stamp session provenance on uploads and emit the completion marker

## Outcome

Every mobile leaf uploads with whole-run session identity and loop provenance, and each completed run emits exactly one manifest-bearing completion marker — durable via boot-time reconcile, never via claimed atomicity.

## Governing context

- [Companion (rev 3)](../../loop-run-provenance-and-completeness/index.md) — leaf identity, marker, N1/N2 resolutions
- Epic precedent: Ticket 8 (upload provenance) field pattern

## Included

- Upload payload fields (optional, snake_case, Ticket-8 pattern): `workbook_session_id`, `iteration_path` (JSON array, length ≤1 in v1), `loop_cell_path`, `loop_values` — stamped on every leaf; session id minted once per run (loop or not); existing `workbook_run_id` semantics untouched.
- Completion marker control record `record_kind: "workbook_session_complete"` with `leaf_manifest` of exact realized leaf keys (as-dispatched device ids — no stable identity concept), `workbook_version_id`, `completed_at`; enqueued through the existing outbox with deterministic client id = session id.
- Boot-time reconcile: derive + re-enqueue markers for persisted completed-but-unmarked sessions (idempotent by id); marker emission independent of preview success.
- Recent-measurements list filters `record_kind` rows (no ghost measurements).

## Explicitly out

- Pipeline/bronze routing (09); web uploads (none in v1); any streaming/backend work (10).

## Dependencies

Ticket 05 (leaves exist).

## Acceptance criteria

- Single-device, multi-device, sparse, and reconnect-mid-loop runs upload manifests that exactly match their realized leaves (as-dispatched ids both sides).
- Kill between loop completion and marker enqueue → marker appears after next launch; duplicate reconciles enqueue nothing new.
- Non-loop runs carry `workbook_session_id` with empty `iteration_path`; legacy payload fields unchanged; IoT Core SQL validity preserved.
- No session/loop values in logs or telemetry (codes/ids only).
- Marker rows never render in the measurements UI.

## Verification

`build-upload-payload` + capture-site + outbox/reconcile suites; full mobile suite on Node 24; record results.

## Guardrails

No cross-store atomicity claims — reconcile is the mechanism; do not alter outbox retry semantics. Leave statuses to the coordinator.
