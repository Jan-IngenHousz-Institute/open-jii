---
title: "Review: Ticket 8 upload provenance metadata (mobile → MQTT → Databricks)"
kind: review
---

# Review: Ticket 8 — command provenance in measurement uploads

Cold review of the codex closure implementer's work: five new command-provenance fields carried from the mobile capture site through the upload payload, MQTT, and the centrum Databricks pipeline. Did not edit app files or artifact statuses.

## Verdict: ACCEPT

All six verification areas hold against the live code. The five fields are populated correctly per dispatch path from the exact value the device received (reusing the Ticket-4 attribution, no re-resolution or fallback), the payload builder is correct and backward-compatible, the log/telemetry guardrail holds (independently grepped), and the Databricks chain carries all five null-safely through every layer. No blockers.

## 1. Five fields per path — correct

| Path | producer_cell_id / kind | dispatched_command | command_source | execution_epoch |
| --- | --- | --- | --- | --- |
| Direct standalone command (`command-node.tsx:144-152`) | `nodeId` / `"command"` | exact per-device `command` (the resolved value dispatched), fulfilled-only | `content.ref` **only** when `isReferencedCommand` | active store epoch |
| Branch command (`use-measurement-capture.ts` `resolveTargetPayload` + `assignmentMetaRef` :260-267) | `node.id` / `"command"` | `resolved.command` (per-device, from `resolveMobileCommand`) | `content.command.ref` only when referenced | active epoch |
| Branch protocol / broadcast protocol (`:281-289`, `:371-377`) | `nodeId` / `"protocol"` | — (absent) | — (absent) | active epoch |

- **Exact per-device value, not re-resolved:** `dispatched_command` is the same `resolved.command`/`command` used to build the assignment that was dispatched, keyed by `device.id` and carried on the persisted `ScanResultEntry` (`flow-transitions.ts`) → `analysis-node.tsx:210-235` maps each entry's own fields into `uploadMeasurements`. No fallback, no cross-device bleed. Two devices carry distinct values (tests assert `command-a`/`command-b`, `command-for-a`).
- **Dynamic-only `command_source`:** gated by `isReferencedCommand` in both command paths; protocols and static commands omit it.
- **Fulfilled-only:** the direct path only projects devices whose transport succeeded; failed devices produce an error outcome in the registry but no upload row — correct (upload carries what a device actually received and replied to).

## 2. Payload builder (`build-upload-payload.ts`) — correct

- Object commands → `JSON.stringify`; string commands pass through. `command_source` → `JSON.stringify({sourceCellId, field})` only when present. All five are small scalar strings → valid for AWS IoT Core SQL.
- Spread order puts the five (and the existing `workbook_run_id`/`version`/`macro_context`) **after** `...rawMeasurement`, so authoritative capture metadata overrides same-named raw device fields — asserted by the "authoritative provenance replaces same-named raw" test (`producer_cell_id`/`dispatched_command` spoof → actual).
- Existing `workbook_run_id`/`workbook_version_id`/`macro_context`/sample-compression/location behavior unchanged; the builder still never mutates `rawMeasurement`.
- Backward compat: legacy callers omit all five (`"omits every provenance field for legacy callers"` asserts `not.toHaveProperty` ×5). Unit test coverage of every field/absence/stringify/override combination is comprehensive and non-vacuous.

## 3. Log / telemetry safety — holds (independently verified)

Grepped every logger/analytics/console sink in all six changed mobile files. Findings:

- **No `posthog`/`capture`/`track`/analytics call exists** in the measurement-flow or recent-measurements upload paths.
- Every `log.*` call carries codes/ids/provenance or an error `.message` only: `commandFailureLogFields` (codes/ids), the direct-command transport-failed log (`{operation, code, commandCellId, targetDeviceId, workbookVersionId, executionEpoch}`), the capture scan-error logs (`err: error.message` — localized failure text or driver string), and the two uploader error logs (`err: message`, **not** the payload/measurement).
- No `dispatched_command`, `command_source`, or resolved command value reaches any sink. `execution_epoch` does appear in a couple of logs, but that is provenance, which the epic rule explicitly permits. `build-upload-payload.ts` has no logging at all.

## 4. Databricks chain (bronze → silver → gold → enriched) — pass

Verified across the four pipeline files (all four parse clean under `ast.parse`):

- **Bronze:** the five fields are read null-safely top-level via `F.get_json_object(F.col("data")…)`, mirroring the `workbook_version_id`/`macro_context` precedent — **not** added to the `parsed_data` struct. This is the sound choice: bronze is non-resettable (`pipelines.reset.allowed: false`), so evolving the nested struct is avoided, and `get_json_object` returns null (never throws) on absent keys → legacy/imported rows yield nulls, not analysis errors.
- **Silver:** present-path reads the bronze top-level columns; legacy/imported-path null-casts all five to `string` — both feed `unionByName` with an identical name set. Matches the existing `workbook_run_id` null-cast fallback exactly.
- **Gold + enriched:** all five passed through wherever `workbook_run_id` is passed; no rename, retype, drop, or NOT-NULL. Uniform snake_case, nullable string at every layer; no unsafe post-bronze JSON parse of the serialized fields.

## 5. Backward compatibility — pass

All fields optional end-to-end; single-result rounds and old/imported records upload/ingest with the columns null. No existing column contract changed.

## 6. Web-skip finding — confirmed correct

Grepped `apps/web` for any measurement uploader into the ingestion (`buildUploadPayload`, MQTT publish, `data_ingest`, `experiment/data` writes). No uploader exists — all matches are read/visualization/filter/export surfaces. Web dynamic-command replies stay in the client-side runtime registry and are never published to the MQTT → Databricks path. Skipping web is correct.

## Minor observations (non-blocking)

- Enriched historically forwards only `workbook_run_id` from the provenance group (not `workbook_version_id`/`macro_context`); the five new fields correctly follow the `workbook_run_id` passthrough and **do** reach enriched. Consistent with the ticket's "wherever `workbook_run_id` is passed today." The pre-existing absence of version_id/macro_context at enriched is out of scope.
- `command_source` in both command paths is read from the flow-node carrier (`content.ref`) rather than the resolved workbook cell; these are equivalent because `cells-to-flow` copies `{sourceCellId, field}` verbatim into the carrier. Harmless.

## Checks run

Node 22 sandbox (repo targets Node 24 for the mobile suite). `pnpm --filter mobile typecheck` clean. Ticket-8 mobile suites (build-upload-payload, use-measurement-upload, use-measurement-capture, command-node, analysis-node, measurement-node): 6 files / 75 tests pass — these are pure/jsdom unit tests, runtime-independent. `apps/data` four pipeline files parse clean (`ast.parse`). **Not run:** full `pnpm --filter mobile test` (Node 22 `better-sqlite3` native-binding issue) and `apps/data` pytest (needs JVM/`JAVA_HOME`; the known turbo strict-env issue — run standalone). Recommend confirming the full mobile gate on Node 24 and `apps/data` pytest standalone before merge.
