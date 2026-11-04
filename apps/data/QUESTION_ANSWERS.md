# Numeric question answers

Approved Number answers are stored as finite DOUBLE values inside `questions_data`
in the existing raw and macro gold tables. The platform and exports apply the same
finite-number rule when reading older rows. Categorical values such as `007` stay
text unless their exact experiment/key is approved as Number.

Gold also keeps `questions_original_data`, the sanitized question object before
numeric conversion. This doubles the stored question object, but preserves exact
lexical answers for metadata identifiers and recovery, including repeated row IDs.
The enriched views use the original for metadata matching and omit the recovery
column from their output. Macro `macro_context`, bronze and silver remain lexical.
The serving feed omits the recovery column and emits the typed `questions_data`.

`experiment_question_types` in Postgres separates a durable `declared_class` guard
from the `active` numeric decision. Pins, restores, imports and flow edits record
question names under the experiment row lock. Deleting a question does not erase
its declaration. A Number/text change needs a new name. New platform experiments
track their complete history and activate Number keys on first pin. Existing
experiments and transfers need a complete historical review before activation.

Mobile uploads every question in the flow. Unanswered, cleared and skipped-branch
questions have JSON null answers. All new gold writes normalize blank answers to
null for every kind, including unapproved text keys. Historical blanks are changed
only in experiments included in the backfill; other stored history is untouched.

## Historical evidence and guard seed

Production reads, seeds, activation and rewrites require separate rollout
authorization. The synthetic dev probes described in the PR are not a deployment.

1. Inventory every experiment with answers, including archived experiments,
   pre-version/imported data, historical workbook versions and removed names.
   Export complete lexical silver rows with `experiment_id`, `workbook_version_id`
   and `questions` to `rows.json`, and referenced workbook versions with `id` and
   `cells` to `versions.json`. Record immutable file hashes, counts and a cutoff.
   Reconcile row and answer counts with the sources. A sample proves no coverage.
2. From `apps/data`, run the offline classifier:

   ```sh
   uv run python -m openjii.question_type_preflight rows.json versions.json > preflight.json
   ```

   It makes no network calls. The report counts recovered kinds, conflicts,
   blanks, invalid numbers and missing versions. It matches name and question
   text within a version. A missing version, unmatched question or colliding name
   prevents numeric eligibility. Numeric-looking text is never evidence of kind.

3. Review the complete report with the experiment owner. Unknown or conflicting
   history stays inactive and lexical until documented evidence resolves it.
   Preserve every historical guard key, including removed questions. Workbook
   snapshots can disappear when a workbook is deleted, so missing source history
   remains a deployment limitation.
4. Produce a reviewed seed with experiment UUID, canonical key, declared class,
   proposed activation and evidence referencing the preflight hash. Save the
   existing ledger and experiment tracking flags. Apply the inactive guard seed
   in transactions locking each affected experiment row. Existing classes must
   agree before any upsert. Set `question_types_tracked=true` only after the full
   history is recorded. Re-run the seed and read it back, expecting no differences.
   Inactive keys remain inactive on later pins; tracking enables newly added keys.

Migration 0064 follows main's unchanged metrics grants in 0063. A disposable database
that ran the branch's former 0063 needs a reset. A shared database in that state
needs its schema and migration history reconciled by a maintainer before 0064.

## Maintenance window and deployment order

Use a maintenance window for both pipelines and configuration writes. A rollout
maintainer must establish a temporary ingress rule returning 503 for public
POST/PUT/PATCH/DELETE requests, with higher-priority exceptions for the four HMAC-only pipeline webhooks:
`/api/v1/experiments/question-types`, `/api/v1/macros/execute-batch`,
`/api/v1/users/metadata` and `/api/v1/iot/devices/registry`. Drain in-flight requests and
project-transfer jobs. Verify experiment creation, flow edits and version pins
are blocked while signed question-type, user-metadata and device-registry lookups
succeed. Verify a signed execute-batch request succeeds before resuming; blocking
it would append permanent macro error rows. This PR does not install the ingress
rule or authorize changing production infrastructure. Without that verified barrier,
do not begin the rewrite. Keep it until the post-resume audit passes.

1. Apply 0064 and the complete inactive guard seed before the updated backend
   accepts pins or flow edits for existing experiments. Otherwise removed names
   are briefly unprotected. Deploy the HMAC batch lookup and updated export task.
2. Deploy bronze/silver kind plumbing, then raw gold and let its additive schema
   update settle, then macro gold. The non-resettable MQTT
   `parsed_data` schema is unchanged; `questions_json` carries the optional kind.
   Old queued payloads remain valid. Let the additive `questions_original_data`
   schema commits settle before recording source versions. A source schema addition
   may stop macro or raw-schema streaming readers once; restart the incremental
   update on the same checkpoint rather than resetting it. Deploy the enriched
   view definitions after both gold columns exist and before reopening reads.
3. Stop upstream ingestion updates and drain raw into macro gold. Record the last
   raw append version and demonstrate that the macro checkpoint has consumed it.
   Compare expected macro rows against eligible raw rows. Stop both pipelines,
   their schedules and any repair writers. Keep configuration and creation paused.
   Raw and macro fetch the ledger at different times, so activation during this
   interval would otherwise let them type the same measurement differently.
4. Pause predictive optimization during the window. Ordinary OPTIMIZE, VACUUM
   START/END and ANALYZE commits are ignored by the history guard. Any other
   non-fingerprinted data or schema commit invalidates the reviewed source. Check
   actual maintenance operation names in target history before the window; an
   unrecognized name refuses safely and needs reconciliation.
5. Use classic compute in **standard access mode** for apply and rollback.
   Dedicated/assigned compute cannot inspect streaming-table history. Serverless
   notebook compute rejects the Delta commit-metadata setting and supports only
   dry run and audit. The probe must confirm the chosen runtime supports UPDATE,
   history, row tracking, VARIANT shredding and fingerprint metadata
   on actual DLT/Unity Catalog streaming tables, not just regular Delta tables.

Gold fails closed when the signed backend lookup is unavailable or incomplete.
It batches at most 500 UUIDs, bounds request time/retries and never treats lookup
failure as an empty registry. Before release, configure the existing pipeline
failure alert for this dependency. Also alert on failed records for the
`valid_numeric_question_answers` expectation. Invalid approved live values become
JSON null and count as expectation failures; the original remains available.
Historical invalid values block apply by default. An explicit reviewed per-key
count can acknowledge known bad answers becoming null while retaining their
originals; unexpected invalid values always block apply.

## Dry run, activation and apply

Run `src/tasks/question_answer_backfill_task.py` with explicit `ENVIRONMENT`,
`MODE=dry-run` and `MANIFEST_JSON`. Dry run is the default. It writes no table.
The version-1 manifest has this shape, using actual values from the paused sources:

```json
{
  "version": 1,
  "evidence": "Reviewed seed and complete preflight input hash",
  "experiments": { "<canonical experiment UUID>": ["height"] },
  "tables": {
    "raw_data": {
      "name": "<catalog>.centrum.experiment_raw_data",
      "backup": "<catalog>.<backup_schema>.<raw_snapshot>",
      "source_version": 123,
      "table_id": "<UUID from DESCRIBE DETAIL>"
    },
    "macro_data": {
      "name": "<catalog>.centrum.experiment_macro_data",
      "backup": "<catalog>.<backup_schema>.<macro_snapshot>",
      "source_version": 456,
      "table_id": "<UUID from DESCRIBE DETAIL>"
    }
  }
}
```

By default `invalid_answers` is absent and no invalid historical input is accepted.
The proposed mapping comes from the reviewed seed plus every already-active
ledger key, including newly tracked experiments created since backend deployment.
Enumerate all stored experiment IDs and the complete Postgres ledger, not only
legacy experiments. Table IDs prevent a same-name replacement from passing the
version check. Backup names must be distinct and outside the pipeline target set. The task
requires both source and backup catalogs to equal `open_jii_<ENVIRONMENT>`,
so a dev registry cannot authorize a production target.

1. Review the dry-run fingerprint, per-table/experiment row counts, changed rows
   and invalid numbers. A missing original also counts as a changed row, even
   when its current value is already numeric. Require invalid numbers to be zero,
   or record exact reviewed counts in optional `invalid_answers`, keyed by table
   role, experiment UUID and approved key. For example, a reviewed single bad
   Height answer in raw uses `{"raw_data":{"<UUID>":{"height":1}}}`. Review macro
   counts separately; one raw measurement may have several macro rows. This is
   an explicit decision to store null for those values while keeping the originals.
   The counts are part of the fingerprint. Apply requires exact counts, not an
   upper bound, and refuses if they change.
   Dry run permits proposed inactive keys but rejects any active key missing from
   the proposal. It reports `registry_matches=false` until activation agrees.
2. Activate exactly the reviewed Number keys in transactions locking their
   experiment rows. Preserve guard classes and evidence. Read back the complete
   live ledger using `BackendClient.get_numeric_question_keys`, and derive the
   manifest mapping from its nonempty key lists. Its fingerprint must equal the
   reviewed dry-run fingerprint. Do not change source versions to hide drift.
   Repeat dry run and require `registry_matches=true`.
3. On the verified standard-access classic compute, use `MODE=apply`,
   `REVIEWED_FINGERPRINT`, `PIPELINES_PAUSED=true`, and
   `MACRO_STREAM_DRAINED=true`. These acknowledgements require the evidence above;
   the notebook cannot pause or inspect arbitrary pipeline schedules for you.
4. Apply creates independent Delta snapshots with CTAS of the current paused
   sources, limited to manifest experiments, before rewriting either table. The
   history guard permits only maintenance since the reviewed source version. It checks source identity, fingerprint properties and
   row counts. Streaming tables cannot CLONE or RESTORE. Each UPDATE atomically
   saves a missing original and converts the approved answers. Existing originals
   are never overwritten. Both gold tables keep their identities and other values.
5. Re-run apply with the same manifest. Expect zero changed rows and no UPDATE.
   A partial run can resume under the same fingerprint if both snapshots exist
   and there has been no unrelated data change. Stay paused on any refusal.

`ready_to_resume` remains false in the apply report: the following gates are manual
and must be recorded by the rollout maintainer.

## Schema rebuild, serving reconciliation and resume

1. Use pipeline `full_refresh_selection` limited to
   `experiment_raw_data_schemas` and `experiment_macro_data_schemas`, in their
   respective pipelines. Pass their fully qualified catalog/schema/table identifiers
   in the API request. Refresh `experiment_table_metadata` afterwards. Verify
   the rebuilt samples contain only the schemas of current gold and approved
   columns report DOUBLE. Old STRING samples would otherwise keep merged types
   lexical. Never request a full refresh of the whole pipeline.
2. Macro and both schema readers use `skipChangeCommits`. Verify their existing
   checkpoints resume without replaying historical macros. Raw gold has
   `pipelines.reset.allowed=false`: an accidental raw reset could be interpreted
   as new appends by macro. A deliberate raw rebuild requires a reviewed property
   change and coordinated downstream reset/reconciliation, including sandbox
   side effects. See the data-repair README before any such repair.
3. The serving feed retains CDF `update_postimage`; ClickHouse uses
   `ReplacingMergeTree(_commit_version)`. Reconcile row identities/counts and
   numeric JSON values after the feed drains. Preserve CDF/log files until the
   largest UPDATE commit is fully consumed. An oversized commit must be measured
   and scheduled within retention before production apply, not assumed to fit.
4. Resume ingestion with configuration/creation still blocked. Macro reclassifies
   lagging old raw files against the same ledger, and retains their original.
   Wait for macro catch-up and compare macro errors with the pre-window baseline,
   refusing new webhook or sandbox failures. Then run `MODE=audit`. Require zero `changed_rows`,
   `new_invalid_numbers` and `raw_macro_mismatches`. Total `invalid_numbers` and
   `invalid_by_key` remain visible even for acknowledged history. A new invalid
   answer after resume needs a fresh reviewed manifest/window or recovery; never
   silently increase an allowance. Compare against expected macro
   coverage as well. A mismatch pauses rollout and requires repair or rollback.
5. Verify raw/macro numeric filters, order, histogram and average, CSV/parquet,
   categorical `007`, lexical metadata matches and macro inputs. Reconcile serving
   parity again, then remove the ingress maintenance rule and restore schedules
   and optimization. Retain snapshots longer than both vacuum and log retention.

## Recovery

Deactivating a key alone does not turn stored DOUBLE values back into text.
Pause ingestion and configuration again, drain/stop macro processing, then disable
all manifest keys under the experiment locks. Preserve their guard declarations.

`MODE=rollback` is the stricter pre-resume path. It requires the reviewed fingerprint,
paused acknowledgement, inactive registry and only fingerprinted/maintenance commits
since the source versions. `MODE=rollback-after-resume` explicitly permits later
appends. It still checks table identity, backup ownership and that every current
question-bearing row has an original before updating either table.

Both modes restore `questions_data=questions_original_data` in place. They preserve
new rows, duplicates, other columns and checkpoints. Exact lexical values such as
`12.50` and `12.5` are restored per row without joining on a nonunique ID. Verify
that every affected row equals its original and counts are unchanged. Rebuild the
two schema summaries and metadata, reconcile serving-store rollback postimages,
and check lexical metadata joins before reopening traffic. Repeat the restoration
check after resume with keys still inactive.

If originals are missing or a source table was replaced, automatic rollback refuses.
Keep the environment paused. Manual recovery from the independent snapshots and
lexical silver is outside this helper and needs a separate reviewed plan. Do not
replace a current table with its snapshot or MERGE by nonunique measurement IDs;
either can lose post-resume rows or restore the wrong lexical value. Existing export
files retain their snapshots; start new exports after recovery.

## Numeric and verification limits

DOUBLE uses IEEE-754 precision. Signs, surrounding ASCII whitespace, `.5`, `5.`,
leading zeros and exponent notation are accepted. NaN, infinity, overflow, Java float
suffixes, hex and malformed strings are invalid. The full-inventory registry lookup shares a
30-second budget across all chunks. A slow or large inventory can time out safely;
retry the lookup after checking backend health, rather than classifying that
refusal as a data-quality finding. Extreme underflow may become zero.
Mobile validates new input and normalizes decimal commas; old queued invalid input
is observable through the expectation above.

Local Spark and isolated Postgres tests cover conversion, Arrow/HMAC lookup,
metadata joins, guard behavior and refusal paths. PR evidence separately records
disposable Databricks streaming-table and checkpoint probes. Production data,
historical classification, serving-store parity and the release window remain
maintainer work. No shared historical activation or backfill has been run.

## Disposable dev runtime evidence

On 4 November 2026, two isolated DLT fixtures verified the additive original column
on existing checkpoints, the same raw/macro table identities, both schema readers,
and the invalid-answer expectation in the event log. A fully qualified raw full
refresh was refused by `pipelines.reset.allowed=false`.

Databricks Runtime 17.3 LTS on standard-access classic compute ran the actual
backfill helpers against these Unity Catalog streaming tables with row tracking,
VARIANT shredding and CDF enabled. Apply, no-op rerun, OPTIMIZE tolerance, wrong
registry/fingerprint/version refusals and per-row lexical rollback passed. CDF
contained update postimages. A second run detected a new invalid answer after
resume, restored all four rows including new arrivals and duplicate IDs, then
completed a fresh reviewed window acknowledging one invalid answer per table.
Its rerun had zero changes and its audit had zero newly invalid answers. The
original bad input remained available and exact `12.50` text was restored again.
Selective schema refresh reported DOUBLE after apply and STRING after recovery.
These synthetic fixtures do not prove production inventory or ClickHouse delivery.
