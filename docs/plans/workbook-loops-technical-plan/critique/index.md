---
title: "Adversarial critique: workbook loops technical plan"
kind: review
---

# Adversarial critique: workbook loops technical plan

Cold read of [the loops tech plan](../index.md) and its [provenance & completeness companion](../loop-run-provenance-and-completeness/index.md), pressure-tested against the merged dynamic-command epic code in this worktree. I did not author these; findings are grounded in the actual code and ordered by what breaks first.

The user-settled decisions themselves are not relitigated. The question here is whether the plan *implements them coherently against the real system*. Several load-bearing claims describe infrastructure that does not exist and reuse that isn't reuse.

**Verification legend:** every finding below was checked against code — @line cited inline.

<user_quoted_section>Rev 2 re-review appended below. The original rev-1 findings are preserved for the record. The current status of each — plus new blockers introduced by the revision — is in the Rev 2 re-review section.</user_quoted_section>

## Rev 2 re-review

Targeted pass on the revised sections only. Verdicts per original finding, then new issues the revision introduces. All rechecked against code.

### Verdict table

| Finding | Verdict | One-line basis |
| --- | --- | --- |
| B1 — Databricks firing is net-new infra | **Partially resolved** | Decision to build streaming + backend-mediated invocation is honest and correct, but it **cannot live in the DLT centrum pipeline** (see N3) and the state machine's supersede path is mechanically unsound (N4) |
| B2 — fan-in incompatible with runtimes | **Resolved (as intent)** | New `fan-in` run mode + parity conformance fixture named; `unwrapMeasurement`/1s-per-item/globals-drift all acknowledged. Residual: input-size limit (N5) |
| B3 — breaking serialization, 426 misses cached | **Partially resolved** | Additive requirement + `flowGraphHasLoop()` + content guards are the right shape; but one named guard site (web read boundary) doesn't exist and offline resume does no re-check (N6) |
| B4 — nested loops collide in mobile state | **Resolved** | User decision: single-level v1, nesting-ready ids; plan stops claiming wrap-counter reuse and adds a real loop scope |
| D1 — single count vs dedupe key | **Resolved** | Replaced count with an explicit realized `leaf_manifest` (sparse + per-device). Sound — *contingent on `device_slot` being real, which it isn't (N1)* |
| D2 — device_id unstable across reconnect | **Not resolved (relocated)** | Fix rests on `device_slot`, which has no implementation, no anchor, and cannot survive a reconnect — see N1 |
| D3 — "never silent" only off-device | **Resolved** | Preview explicitly labelled preliminary; field-user-not-notified recorded as a known limitation |
| D4 — marker coupled to preview success | **Resolved in intent** | Marker now emitted regardless of preview — but the durability mechanism it leans on is impossible (N2) |
| D5 — firing misdescribes the real path | **Resolved** | Correctly routes pipeline → backend `/processing/execute-session` → sandbox; backend owns retries/idempotency (session id + input-manifest hash) |
| D6 — reclassification understated | **Resolved** | Enumerates every touch point; introduces `"expression"` kind + read-legacy-`"macro"`-forever + load-time mapping; called a migration ticket |
| G1 — web has no leaves/upload | **Resolved** | User decision "web executes, mobile records"; companion scopes the authoritative record mobile-only in v1, explicitly |
| G2 — record_kind routing + UI leak | **Resolved** | Routes to `session_control`; recent-measurements list filters `record_kind` rows |
| G3 — naming footgun | **Resolved** | Renamed to `workbook_session_id`; `workbook_run_id` keeps its meaning |
| G4 — sparse/skipped iterations undefined | **Resolved** | Leaf defined as sparse-by-design; manifest = realized set; Processing works from the realized set |
| G5 — loop_values not "small scalar" | **Acceptable for v1** | Single-level keeps it small; note it's an object, not a scalar, once nesting lands |

### New issues introduced by the revision

**N1 (blocker) — `device_slot` is entirely unbacked; the D1/D2 completeness fix rests on an identifier that cannot be produced.** The revision keys leaf dedupe and the manifest on `(workbook_session_id, iteration_path, producer_cell_id, device_slot)`, asserting a "stable per-run logical device index assigned at loop start" that "keeps the slot while the underlying id changes" on reconnect. Verified against mobile code:

- No slot concept exists anywhere (`grep slot|device_slot|deviceSlot` → only unrelated logging).
- The nearest thing, `devicePlan` (`flow-transitions.ts:31-34`), is keyed on the **transient** `Device.id` (Android USB id / MAC), is explicitly **not persisted** (`:86-88`, excluded from `partialize`), and is **cleared every iteration** (`clearedBranchIteration`, `:135-141`).
- After a reconnect, the device re-enters the registry at the **end of connect order** under a new `Device.id` (`serial-port-connection.ts:27-37,62-71`). The one potentially stable anchor — firmware `DeviceIdentity.deviceId` (`packages/iot/.../families.ts:18-26`) — is captured best-effort and is **frequently undefined** (`scanner-command-executor-store.ts:144-152`), and nothing maps it to a position. A physically **replaced** unit is indistinguishable from a reconnect.

So there is nothing to anchor a reconnected device back to slot N. **Breaks first:** the exact multi-device + reconnect field scenario D1/D2 were meant to fix — the manifest names `device_slots` that the client cannot assign stably, so completeness either mismatches or requires inventing the slot mechanism from scratch. **Suggestion:** either specify the slot anchor concretely (require firmware `deviceId`, and define fallback behavior when it's absent — the common case today), or reframe completeness around what *is* stable (iteration × producer presence) and treat per-device asymmetry as best-effort.

**N2 (blocker for the crash-safety guarantee) — "marker persisted to the outbox atomically with loop completion" is impossible as stated.** The failure table's top row leans on this atomicity. Verified: loop completion is an `isFlowFinished` flag in the Zustand `measurement-flow-storage` store backed by **AsyncStorage** (`use-measurement-flow-store.ts:413-415`; `finishFlowState` `flow-transitions.ts:283-290`). The outbox/measurements live in **SQLite** (`outbox.ts:20-23`; `shared/db/client.ts` `openDatabaseSync("measurements.db")`). These are different engines; the only transaction primitive (`db.transaction`, SQLite-only) cannot span AsyncStorage, and **no end-of-run marker/control record exists today at all**. **Breaks first:** the promised "crash between loop end and marker send is covered by atomic persistence" — the crash window is real, not closed. **Suggestion:** drop the atomicity claim; rely on the reconcile-on-boot path the outbox already uses (`rehydrate()` re-enqueues unsynced rows, `outbox.ts:396-414`) by making marker emission an idempotent derivation from persisted completion state on startup, or move completion into SQLite so `db.transaction` can enclose both.

**N3 (blocker — scope/location) — the streaming completeness layer cannot live "in the centrum pipeline"; it is a separate Structured Streaming application.** The companion says "build real stateful streaming *in the centrum pipeline*." Verified: centrum is **Delta Live Tables**, non-serverless, triggered (dev) / continuous (prod) (`infrastructure/env/*/main.tf`; `databricks/pipeline/main.tf`). DLT abstracts the streaming query behind `@dlt.table`/`create_streaming_table`/`append_flow` — there is **no user-controlled `writeStream`/`foreachBatch` handle**, and **zero occurrences** of `foreachBatch`, `writeStream`, `applyInPandasWithState`, `flatMapGroupsWithState`, `session_window`, `withWatermark`, or `apply_changes` anywhere in `apps/` or `infrastructure/`. No standalone Structured Streaming job exists (the `databricks/job` module runs only batch tasks + a pipeline trigger). **Consequence:** the session-completeness engine + `sessions_ready` + `foreachBatch` sink is a **new streaming application on a different deployment/ops surface** (its own checkpoints, cluster, monitoring) than the DLT pipeline — not an extension of it. The plan's parenthetical "(or triggered job on that stream)" undersells this. **Suggestion:** state plainly that this is a new streaming job outside DLT, and cost the ops surface (checkpointing, restart semantics, cluster) accordingly.

**N4 (design gap in the streaming state machine) — watermark eviction and post-`Processed` supersede are mutually exclusive within one stateful operator.** The state diagram shows `Processed --> Processed: late leaf/marker → supersede` as if inside the same streaming aggregation. But a watermark (`T`/`T2`) that lets partial results fire **also evicts the session's streaming state**; a leaf arriving after eviction cannot rejoin that state. So supersede must be driven by a **separate batch reconciliation** that re-reads the durable leaf table and `MERGE`s the result (the repo's only `MERGE` is exactly such a batch task, `project_transfer_task.py:122`) — not by the streaming operator. Relatedly, **which timestamp drives the watermark is unspecified**: the device `timestamp` is event-time and is *old* for offline field data (days-stale), while `ingestion_timestamp` is processing-time. A watermark on device time would strand offline batches below the watermark; a watermark on ingestion time is really a processing-time timer. **Breaks first:** either late leaves are silently dropped (event-time watermark) or the "supersede after Processed" transition never fires (state already evicted). **Suggestion:** split the design explicitly into (a) a streaming completeness *signal* and (b) a batch *recompute/supersede* over durable tables, and name the watermark's time column.

**N5 (residual on B2) — the fan-in input may exceed the Lambda synchronous invoke limit.** The plan bounds fan-in by "the Lambda's existing 60s/10MB ceilings," but those are the *output* ceilings (10 MB wrapper stdout, 6 MB sync response). The **input** to a synchronous Lambda invoke is also capped at 6 MB, and fan-in delivers "the run's ordered leaf array" — up to the default bound of **1000 leaves**, each carrying full measurement `data`. A modest 100-iteration × multi-device run with raw MultispeQ samples can exceed 6 MB of input alone. **Suggestion:** address the invoke-input size explicitly — chunked/streamed input, an S3-pointer input, or a lower effective leaf/size cap for fan-in — and state it beside the output ceilings.

**N6 (residual on B3) — the guard sites are more net-new than "mirror … in every place the epic refuses ref graphs" implies.** Verified: the epic's refusal exists in exactly one place per read — the **backend** (`get-workbook-version.ts:45`, `get-flow.ts:53` + a strict-parse boundary at `get-flow.ts:71`). Web is a thin oRPC hook with **no read boundary** to mirror into (`useWorkbookVersion.ts:14`, `useExperimentFlow.ts:10`); a web-side content guard would be net-new (e.g. beside `cellsToFlowGraph` at `design/page.tsx:92`). The mobile resume guard *does* exist and is a genuine, well-placed extension point (`flow-rehydration-guard.ts:92-110`, fails closed via `resetIncompatibleResume`), **but** it validates structure/provenance only and **offline resume performs no capability/version re-check** — the persisted graph is trusted. So `flowGraphHasLoop()` is a real and correct addition in two spots (backend fetch, mobile resume) and a *new* construct on web. Minor but worth correcting so the guard work isn't under-costed. Positive note: `cells-to-flow` already round-trips goto "loops" and a server-side cycle detector exists (`flow-graph-topology.ts:82`), so the additive-serialization requirement is testable as the plan asks.

### Net assessment of rev 2

The revision is a substantial, good-faith response: 11 of 15 original findings are genuinely resolved, and the two hardest architectural truths (fan-in must be built; the pipeline can't call Lambda directly) are now scoped honestly. The remaining risk clusters in the **provenance/completeness plumbing**, not the design's shape:

- **D2 didn't get fixed — it moved.** `device_slot` (N1) is the new load-bearing assumption and it has no implementation path against the current device layer. This is the one I'd block on.
- **Two durability claims are stated as if backed when they aren't:** the atomic marker (N2) and the "in the centrum pipeline" streaming (N3). Both are buildable, but as *new* mechanisms/surfaces, and the plan should say so.
- **The streaming state machine (N4) needs a batch/stream split** before it can express supersede.

**Blockers to clear before ticketing the provenance/completeness work:** N1 (device_slot anchor), N4 (stream vs batch supersede + watermark time column), and honest re-scoping for N2/N3. B2's N5 is a sizing detail to nail down, not a blocker.

## Blockers — the authoritative half rests on infra that isn't there

### B1. "Databricks fires the Processing step per `loop_run_id`" is net-new infrastructure, not a DLT step

<user_quoted_section>"Trigger evaluation lives in the centrum pipeline (a DLT step over the control table + leaf counts — effectively a session window keyed by loop_run_id)… the pipeline invokes the same stored script… via the existing macro-sandbox Lambda."</user_quoted_section>

The centrum pipeline cannot express any of this today:

- **No watermark, no session window, no stateful streaming aggregation** exist anywhere in `apps/data/src/pipelines/centrum/`. Silver is append-only (`dlt.create_streaming_table` + `@dlt.append_flow` in `clean_data.py:26,52,322`); grep for `withWatermark`/`session_window`/`apply_changes`/`MERGE` returns zero hits. A "session window keyed by `loop_run_id` with watermark `T`" is new stateful structured-streaming code that declarative `@dlt.table` transforms do not contain.
- **The pipeline never invokes a Lambda directly.** The only per-run-ish external call is a *per-row* pandas UDF that POSTs to the **backend** REST endpoint `/api/v1/macros/execute-batch` (`gold/experiment_macro_data.py:37,97`; `lib/enrich/enrich/macro_execution.py`), keyed by `macro_id`+`workbook_version_id`, after `F.explode("macros")` — not by run, not on completion, and not to the sandbox Lambda. The backend fans out to Lambda. There is no `boto3`/`lambda.invoke` in the pipeline. The other egress is a Slack-on-failure lifecycle hook (`hooks.py`) with no row access.
- **The supersede model has no substrate.** "Idempotent supersede… bump `result_version`, consumers read latest" needs upsert/CDC; the pipeline has zero `apply_changes`/`MERGE`. Late-data handling today only *records* `ingest_latency_ms`; it never acts on it.

**Breaks first:** the "authoritative Databricks result per `loop_run_id`" — the whole off-device half of the feature — simply never fires. You ship the in-app preview and nothing else, silently.

**Suggestion:** name the new infra explicitly. Either (a) a `foreachBatch`/`boto3` sink outside the declarative graph, or (b) move run-completion + Processing to a **backend job** consuming the control record (which is where Lambda invocation already lives), and treat the pipeline as pure table transforms. Don't describe it as "a DLT step" — that hides the largest build in the plan.

### B2. "Same definition, two run sites" over a leaf **array** is incompatible with both runtimes

<user_quoted_section>"the pipeline invokes the same stored script… input = the run's ordered leaves [{iteration_path, loop_values, data, …}]… One definition, two run sites." / "One definition — no dual authoring, no drift."</user_quoted_section>

Both the macro-sandbox Lambda and the mobile runner are **fan-out (N-in / N-out per sample)**, not **fan-in (array-in / 1-out)**:

- Lambda: `wrapper.js:169` loops per item, injecting a single `json` each pass; `unwrapMeasurement` (`wrapper.js:64-67`) actively **strips any array to element `[0]`** before injection. A script handed the leaf array sees only `leaves[0]`. Output is one result per item.
- Mobile: `process-scan.ts:109` loops per sample, `executeMacro(code, samples[i], ctx)` — never passes the array.

A Processing step that must read all leaves needs a **new injection mode in both runtimes**. And the "no drift" claim is already false for the *existing* macros: the globals contracts differ — Lambda exposes a mutable `output` global + `input_data` and blocks `Date`/`Function`/timers (`wrapper.js:96-141,172`); mobile uses a bare `new Function` with only `json`+`ctx` (`process-scan.ts:45-51`), no `output` global, full JS runtime. A script using the MultispeQ `output["x"]=…` convention runs on Lambda and **throws on mobile**.

Also the limit claim is wrong: "1MB script / 10MB output / 60s" conflates scopes — the VM cap is **1000 ms per item** (`wrapper.js:177`), 60s is the whole-subprocess ceiling. A single fan-in aggregation over up to 1000 leaves (your default bound) has no defined budget under the current per-item model, and 1000 leaves × non-trivial `data` risks the 10MB stdout / 6MB Lambda-response ceilings (`handler.js:103`).

**Breaks first:** the first Processing step authored to aggregate returns a result computed over one leaf (Lambda) or crashes (mobile).

**Suggestion:** make the array-in/1-out aggregation contract an explicit deliverable in both runtimes, reconcile the globals contract (or scope the Processing step to a single runtime), and restate the real limits.

### B3. Loop container is a breaking serialization change and the 426 boundary does not cover it

<user_quoted_section>"the flat cells↔flow-graph mapping gains a container encoding… behind the capability gate."</user_quoted_section>

The flow graph is a flat node list with a **closed `type` enum**, `.strict()` Zod schemas + a content↔type `superRefine`, and converters that `default: return null` on unknown nodes (`packages/api/src/transforms/*`, `experiment.schema.ts`). A new container/loop node type therefore **fails parse or is silently dropped** on already-shipped clients. And the capability handshake fires **only inside `GetWorkbookVersionUseCase.execute`** (`get-workbook-version.ts:45-58`) — the version-**fetch** path. An already-cached / offline flow on an old client never traverses that code, so it never receives a 426.

The angle-2 concern (offline resume mid-upgrade) is partly moot — new loop content only reaches a client via fetch, which 426 catches *online*. The real exposure is two-fold: (a) there is **no content-level marker** the way `hasDynamicCommandRef` scans cells, so nothing fails an old client closed on cached content; (b) the plan must guarantee the container encoding is **strictly additive** — if `cellsToFlowGraph` changes the shape of *non-loop* flows, every old client breaks on every workbook.

**Breaks first:** a `.strict()` parse throw or a null-dropped node on a client that fetched around the gate, turning "refused cleanly" into "silently broken."

**Suggestion:** add a content-level capability marker analogous to `dynamic-command-ref-v1`, and prove additivity with a round-trip test asserting non-loop flows serialize byte-identically against the pre-loop parser.

### B4. Nested loops (in v1) collide in the mobile iteration machinery — "reuse" is new machinery

<user_quoted_section>"reuse and formalize the existing iterationCount / branch-iteration machinery… startNewIterationState's output clearing becomes per-iteration body clearing scoped to the loop."</user_quoted_section>

The existing machinery is **whole-flow, single-scope** (`flow-transitions.ts`):

- `iterationCount` is one scalar, always paired with `currentFlowStep: 0` (full-flow wrap), and doubles as the answers-history index (`iteration.ts:53,107`). There is no per-loop counter and no container/nesting field on `FlowState`.
- `branchVisitCounts` (`Record<nodeId,number>`), `consumedNodeIds` (`string[]`), and `outputsByCellId` (`Record<cellId,…>`) are **flat, keyed by node/cell id with no depth dimension**. With nested containers, a body cell entered under the inner loop and the outer loop shares one slot → collision.
- Clearing is **wholesale** (`clearedCycleOutputs` sets `outputsByCellId: {}`, mints one global `executionEpoch`; `clearedBranchIteration` empties everything). There is no subset/scope filter. "Scoped-to-body clearing" does not exist and would destroy the outer iteration's live state if applied wholesale, or collide on cell id if not.
- Termination today is user-driven wrap-to-0; there is **no bound cap and no loop-exit machinery** at all.

Single non-nested loops are a plausible reuse. **Nested loops — which the plan puts in v1 — are not.** They require a container-instance key dimension, scoped clears, and per-container epochs: new machinery, honestly costed.

**Breaks first:** a two-level loop (the plan's own headline example, "measure at light X,Y,Z" inside an outer loop) overwrites inner/outer outputs on shared cell ids, corrupting the leaf set.

**Suggestion:** either descope nesting to v2, or specify the composite-key model and per-container clearing/epoch as an explicit deliverable. Don't call it "formalize existing."

## Drift & contradictions

### D1. Multi-device leaf count contradicts the dedupe key

The marker carries a single `realized_leaf_count`, but dedupe is `(loop_run_id, iteration_path, device_id)`. For a loop of *k* iterations over *D* devices, distinct leaves = *k·D*. If `realized_leaf_count` counts iterations (*k*), `distinct leaves == realized_leaf_count` is never true → the run is stuck in `ReadyPartial` forever and only ever fires via the watermark. The two definitions must agree. **Suggestion:** define the count as distinct `(iteration_path, device_id)` pairs (and say so), or make completeness per-device.

### D2. `device_id` in the dedupe key is only stable when firmware supplies it

`build-upload-payload.ts:79-83`: firmware `device_id` wins, else a **transient** local USB id ("transient across replugs," per the code comment). The epic treats a reconnect as a **new identity**. A device that reconnects mid-loop uploads later iterations under a different `device_id` → the same logical leaf counts as two distinct rows, so the count never matches (perpetual partial), and `realized_leaf_count` computed at run end disagrees with what landed. **Breaks first:** multi-day offline field sessions with any reconnect. **Suggestion:** dedupe on `(loop_run_id, iteration_path)` with device as a carried attribute, or make firmware `device_id` a hard requirement for loop runs and state the dependency.

### D3. "Never silent" divergence is observable only off-device

The in-app preview is computed from the leaves the app *has*, so from the field user's vantage it is always "complete." The authoritative Databricks result may be `complete=false`, but v1 has **no result push-back to the app**. So the `complete` flag / manifest hash make the divergence observable only to a *data-plane consumer* — never to the field scientist, who sees a confident preview. The plan's "never silent" overreaches. **Suggestion:** soften to "observable in the data plane," and record "field user is not notified of divergence" as an explicit v1 limitation.

### D4. Marker emission is coupled to local Processing-step success

The marker is emitted *"when… the Processing step ran locally."* If the local (preview-only) script throws offline, no marker is sent — even though every leaf uploaded and the count is right — so the run falls to the **T2 7-day long-stop** before the authoritative result fires. The failure table has no "local Processing step failed" row. **Breaks first:** one buggy preview script delays every authoritative result by a week. **Suggestion:** decouple — emit the marker on loop *completion* regardless of preview success; treat preview failure as independent and non-blocking.

### D5. The firing description misstates the real macro-execution path, and script resolution is unspecified

Beyond B1: the plan says Databricks runs "the same stored script… via the existing macro-sandbox Lambda," but the existing path is pipeline → **backend HTTP** → Lambda, per-row by `macro_id`. How the run-completion trigger resolves `workbook_version_id` → the Processing-step script (a control-plane lookup from the data plane) is unspecified. Also note the macro gold path currently **drops `workbook_run_id`** (`experiment_macro_data.py` selects `workbook_version_id`/`macro_context` only), so even the existing per-run id doesn't reach macro processing today. **Suggestion:** align the description to the backend-mediated path and specify script resolution by version.

### D6. Reclassifying analysis→command as "Expression" is more than a "cheap rename"

`producerKindFor` maps flow node `analysis → "macro"` (`runtime-output.ts:64`). A new "Expression" kind ripples through: the `MobileProducerKind` union (`:10`), `normalizeMobileProducerData` branches (`:39-51`), `sharedMacroOutput`/`mergeDeviceMacroOutput` which hard-code `"macro"` (`:95,103`), the **narrower** `producer_kind: "protocol" | "command"` type on the upload payload (`build-upload-payload.ts:29`), and the `producer_kind` column already extracted in bronze/silver (`raw_data.py`, `clean_data.py:82`). The wire value is a schema-level concern, not "authoring UI labels + docs." **Suggestion:** enumerate these touch points and decide explicitly whether Expression is a new `producer_kind` on the wire or stays `"macro"`.

## Gaps & ambiguities

### G1. "Collected leaves" is undefined on web, and web may have no upload path at all — the completeness machinery is effectively mobile-only

Web run state is fully ephemeral: refs/`useState`, wiped by `invalidateRuntime`, gone on unmount/refresh; nothing is persisted per run (`useWorkbookExecution`). Web has **no iteration machinery** — only a capped branch-goto rewind (`MAX_VISITS = 100`) deliberately built to *prevent* loops. Worse, Ticket 8 itself left open "does web execution upload measurements into the ingestion?" If web does not upload leaves to MQTT, then for a loop **authored and run on web** there is no `loop_run_complete` marker, no leaves in bronze, and therefore **no authoritative Databricks result** — only the in-app preview. The plan presents `loop_run_id`/completeness as host-neutral; it is mobile-only in practice, which collides with "web + mobile together in v1." **Suggestion:** state web's leaf-persistence and upload story explicitly; if web doesn't upload, scope the completeness/authoritative machinery as mobile-only and say so plainly.

### G2. `record_kind` bronze routing is net-new, and a control record riding the outbox leaks into the mobile UI

Routing by `record_kind` has no precedent — bronze tables split by transport, not payload discriminator (`raw_data.py` etc.), and `record_kind` is absent from `sensor_schema` (`schemas.py`). It lands as new work either in the Terraform IoT rule (`WHERE` + separate stream/sink) or as a new `@dlt.table` filter + schema field. Separately, the outbox *can* carry a control record (it's schema-agnostic — stores/publishes an untyped object, `outbox.ts:295`, `measurements-storage.ts:38`), but `deriveListColumns` runs over every stored row, so the control record would **surface in the measurement list UI** unless explicitly filtered, and `_client_id` is always injected. **Suggestion:** specify where routing lives (schema + bronze branch) and that the mobile measurement list must exclude `record_kind` rows.

### G3. `loop_run_id` vs `workbook_run_id` is a naming footgun

Both ids coexist. `loop_run_id` is the **whole-run** id; `workbook_run_id` is the **narrower** per-multi-device-round id (`use-measurement-upload.ts:120`, and silver comments already define it as "one uuid per multi-device round"). The more-specific-sounding name is the broader concept — pipeline authors already read `workbook_run_id` as "the round." The companion artifact half-acknowledges this ("name kept host-neutral") but keeps it. **Suggestion:** rename to something like `workbook_session_id`/`run_id`, or reconsider promoting `workbook_run_id` to always-present rather than introducing a parallel id with an inverted name relationship.

### G4. Leaf-count semantics under skipped/failed iterations are undefined

If a branch inside the body skips the measurement on some iterations, or a measurement fails, it is unclear whether that iteration counts toward `realized_leaf_count` and whether the Processing step tolerates gaps in `iteration_path`. This directly affects whether completeness ever reaches `Ready`. **Suggestion:** define `realized_leaf_count` as leaves *actually produced*, and specify the Processing-step contract for sparse `iteration_path`.

### G5. `loop_values`/`iteration_path`/`loop_cell_path` are nested JSON, not "small scalars"

Ticket 8's size assurance ("small scalars, no compression impact") was written for flat scalar provenance. These new fields are JSON arrays/objects that grow with nesting depth; each also needs a `get_json_object` extraction + `sensor_schema` field mirroring the Ticket 8 pattern (`raw_data.py:60-91`). The IoT rule is `SELECT *` so it passes them through, but the size/shape claim should be restated for nested values. Minor, but worth correcting so it isn't treated as free.

## What holds up

- **"No cross-iteration state in the resolver"** — verified true. `command-resolution.ts` is types-only; `resolveCommandPayload` (`command-payload.ts:90`) is a pure per-call function with the runtime lookup injected as a callback. The caller must supply per-iteration outputs, which is consistent with the plan.
- **Expressions restricted to JS/Python** matches the runtimes (mobile `new Function` + `PythonMacroRunner`; R only server-side).
- **The Expression/Processing split as a concept** cleanly removes the need for accumulation state in the resolver — the reasoning is sound; the problems are all in the *execution and completeness plumbing*, not the split itself.
- **One caveat on the resolver ordering invariant:** author order is a **flat** position index over non-output cells (`dynamic-command-refs.ts:120-191`) with no nesting representation. "Earlier within the same iteration" (plan decision 3) has no encoding today — the flat `sourcePos < commandPos` rule can't distinguish same-body-earlier from globally-earlier. The invariant needs a scoping layer before it can be enforced for loop bodies.

## Top 3 to resolve before ticketing

1. **B1 + B2 together** decide whether the "authoritative Databricks" pillar is buildable in v1 at all, or whether it becomes a backend job + a new aggregation contract. This is the single largest hidden build.
2. **B4** — nested loops in v1 is a decision that multiplies the mobile-state work; confirm scope or cost the new keying honestly.
3. **D1/D2** — the completeness math is currently self-inconsistent for the multi-device + reconnect case that field use guarantees. Fix the count/dedupe definition before anyone builds the watermark.
