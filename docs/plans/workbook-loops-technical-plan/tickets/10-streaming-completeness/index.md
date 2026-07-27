---
title: "Build the streaming completeness layer and session processing service"
kind: ticket
status: 0
---

# Build the streaming completeness layer and session processing service

## Outcome

Completed sessions are detected and processed authoritatively: a **new Structured Streaming application** (separate deployment surface — not a DLT extension) decides completeness, a batch reconcile owns supersede, and a new backend endpoint executes the Processing step via sandbox fan-in into `session_results`.

## Governing context

- [Companion (rev 3)](../../loop-run-provenance-and-completeness/index.md) — two-layer design (critique N3/N4), invocation boundary, N5 input transport
- User decision: build real streaming infrastructure

## Included

- **Streaming detection app** (new `apps/data` surface + IaC): reads leaf + `session_control` streams; per-session state (manifest vs leaves seen); **processing-time timers on the ingestion timestamp** (`T` 24h post-marker, `T2` 7d long-stop — config, not code); emits `sessions_ready(session_id, complete, missing_set)`; state evicted on decision; own checkpoints/cluster-or-serverless job config/monitoring/IaC.
- **Batch supersede reconcile**: scheduled MERGE job comparing the durable leaf table vs `session_results.input_manifest_hash` for decided sessions; changed realized sets re-emit to `sessions_ready`; `session_results` MERGE-upserted with `result_version` (latest wins, idempotent).
- **Backend `/processing/execute-session`**: loads the session's ordered leaves, stages input to S3 above the inline threshold, invokes sandbox **fan-in** once with the `workbook_version_id`-pinned script, returns/records the result; idempotency key = session id + input manifest hash; retries with backoff; terminal failure recorded (`result=null, error_code`) without blocking the pipeline.
- `session_results` table: `(workbook_session_id, workbook_version_id, result, complete, missing_leaves, input_manifest_hash, result_version, computed_at)`.
- Wiring choice (sink→backend vs job-pull) is implementation judgment within the constraint: **the pipeline never invokes Lambda directly; backend owns sandbox invocation; data side owns table writes.**

## Explicitly out

- Result push-back to the app; web sessions; cross-run aggregation; R; any rollout enablement.

## Dependencies

Tickets 03 (fan-in), 09 (tables). Runs against ticket-06-shaped data.

## Acceptance criteria

- Complete session (marker + full manifest match) → result within one detection cycle, `complete=true`.
- Missing leaf → partial at `T` with exact `missing_leaves`; late leaf afterwards → reconcile recomputes, `result_version` bumps, prior result superseded (no double-count).
- No marker → long-stop partial at `T2`; late marker → supersede to complete.
- Duplicate leaves (outbox retries) never alter results (dedupe on full leaf key).
- Endpoint idempotent under replay; sandbox failure recorded, retried, non-blocking.
- Streaming app restart mid-accumulation resumes from checkpoint without losing or double-deciding sessions.
- Timers config-driven; no rollout switch flipped anywhere.

## Verification

Streaming app integration tests (local Spark, simulated late/duplicate/no-marker sequences); backend endpoint suite (real DB); reconcile MERGE tests; end-to-end fixture from ticket-06 payload shape → `session_results`. Record exact commands/results.

## Guardrails

Leaf data and results stay in the data plane (logs: ids/codes/counts only); never fabricate completeness — partial results must always carry the missing set; new infra is dark until the epic's rollout gate. Leave statuses to the coordinator.
