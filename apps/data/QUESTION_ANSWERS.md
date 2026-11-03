# Numeric question answers

Gold keeps the original answer strings in `questions_data`. The platform casts approved
Number columns to finite DOUBLE on every read. The same rule applies to raw and macro
tables, filters, sorting, histogram inputs, aggregates and exports. There is no physical
gold rewrite, and no mixed STRING/number VARIANT column to repair.

`experiment_question_types` in Postgres has two separate decisions per experiment and
canonical question key. `declared_class` protects the name from Number/text changes.
`active` enables numeric reads. Only a number declaration can be active. Deleting a
question does not delete its declaration. Attaching, upgrading, selecting an older
version, importing a project and editing a flow all register their questions under the
experiment row lock. A version pin, its flow and its declarations commit together.

New experiments created through the platform start with tracked history. Their Number
questions activate when first pinned. Existing experiments and project transfers start
untracked. Their current Number question alone is not evidence about historical data.

## Historical preflight and reviewed seed

No shared read, seed or activation was run for this change. Obtain authorization before
reading a warehouse or exporting production snapshots. The procedure below is a rollout
prerequisite for existing data, especially names removed before this change.

1. Inventory every experiment with question answers, every historical version used by
   its measurements, pre-version/imported rows and current workbook/flow questions.
   Export complete silver rows with `experiment_id`, `workbook_version_id` and `questions`
   to `rows.json`. Export the referenced Postgres `workbook_versions` as objects with
   `id` and `cells` to `versions.json`. Include archived experiments. Record source
   counts, export time, immutable file hashes and a cutoff. Reconcile exported row and
   answer counts against the sources. A sample cannot establish complete coverage.
2. Run the offline classifier from `apps/data`:

   ```sh
   uv run python -m openjii.question_type_preflight rows.json versions.json > preflight.json
   ```

   It makes no network calls and writes no database. Re-running identical files produces
   the same report and input hash. The report counts answers, recovered version kinds,
   missing versions, unknown kinds, conflicts, blanks and invalid numbers per column.
   It matches exact name and question text within one version. Duplicate/colliding names,
   missing/deleted versions and conflicting kinds require review. A missing version or
   unmatched question increments `no_version` and prevents numeric eligibility even
   when the payload declares Number. It never infers Number
   from a numeric-looking string. Workbook snapshots are insert-only by app convention,
   not protected from manual SQL updates, and disappear when their workbook is deleted.

3. Review the complete report with the experiment owner. Recover unknown kinds only from
   documented historical evidence or an explicit reviewed classification. Otherwise keep
   the column inactive and serving text. A Number/text conflict needs a reviewed guard
   class and a new name for future questions of the other class. A mixed or unproven
   column must not become active merely because its current workbook says Number.
4. Produce a reviewed seed file for **all** historical canonical keys, including removed
   names. Each entry needs experiment id, key, declared class, active decision and an
   evidence reference with the preflight hash. Save the existing ledger rows and tracking
   flags before applying it. Do not derive the guard history only from the currently
   pinned workbook. Reconcile the inventory again at the cutoff, or stop configuration
   edits briefly while the reviewed seed is applied.
5. Apply the seed in a transaction that locks each affected experiment row, the same lock
   the pin guard uses. Use the primary key `(experiment_id, key)` for idempotent upserts.
   Assert existing declarations agree with the reviewed class before changing activation.
   Set `question_types_tracked = true` only after the experiment's complete guard history
   is recorded. Existing inactive keys stay inactive on later pins; the flag permits
   newly introduced Number keys to activate. Re-running the reviewed seed must produce
   no differences. Read it back and compare every entry, class, activation and evidence.
6. Before activation, run the proposed cast over every approved column and report total,
   missing, valid and invalid counts. The numeric grammar is in
   `openjii.number_answers.NUMBER_ANSWER_PATTERN`; the backend generates the equivalent
   SQL in `expressions/number-answer.ts`. For a column expression `answer`, the quality
   check is the count of nonblank source strings for which that expression returns NULL.
   Every invalid count needs a decision. Never replace the original gold answer.
7. Activate only the reviewed number keys. Compare table column metadata, raw and macro
   reads, a numeric filter/order, histogram inputs and `avg`, and download CSV and parquet
   exports. Check that categorical `007`, Yes/No and custom metadata matches remain exact.
   The schema revision includes the sorted active-key hash, so changing activation also
   invalidates the platform's cached column types. No schema-sample or gold replay is needed.

The guard cannot reconstruct pre-deployment removed names from Postgres alone, which has
no per-experiment version usage history. The complete historical seed is required for
that guarantee. Missing source history remains a stated deployment limitation.

## Deployment and rollback

Deploy the additive Postgres migration and the updated export task before the backend
starts sending `NUMERIC_QUESTION_KEYS`. Deploy the API/mobile and additive bronze/silver
kind plumbing. The nested non-resettable MQTT `parsed_data` schema stays unchanged;
`questions_json` captures the kind alongside it. Old queued payloads remain valid. Gold
still holds lexical values and normalizes cleared answers to JSON null. This also
changes historical blank or whitespace-only text answers to null when those rows are
processed, following the unanswered/cleared rule for every question kind.

Review and apply historical guard seeds before allowing version changes on existing
experiments. Enable numeric reads after the coverage and quality checks above. There is
no authorization here to deploy or seed a shared environment.

To undo an incorrect numeric activation, set its `active` value back to false under the
experiment lock. The next table/schema read uses the original text and a different
schema revision. Preserve the guard declarations unless the reviewed seed itself was
wrong; restore those and tracking flags from the saved pre-seed rows if necessary.
Already-created export files retain their original snapshot. Start a new export after
rollback; an in-flight export may already have received its numeric-key job parameters.
No source answer, macro output, metadata join or ingestion checkpoint needs restoring.

## Limits and local evidence

DOUBLE uses IEEE-754 precision. `.5`, `5.`, leading zeros, signs, surrounding whitespace
and exponent notation are accepted. NaN, infinity, overflow, Java float suffixes, hex and
malformed strings read as NULL. Extreme underflow follows DOUBLE and can become zero.
Numeric validation on mobile prevents malformed new input and normalizes a decimal comma
to a dot. Existing bad answers remain available in gold for investigation.

Direct warehouse, notebook/Genie and ClickHouse reads remain lexical. There is currently
no ClickHouse application reader. A notebook that needs numbers must apply an explicit
reviewed classification and cast. Macro `ctx` answers and custom-metadata joins keep
their original strings, including lexical identifiers such as `007` and `12.50`.

Local checks use isolated Postgres and OSS Spark 4.0.1, not a shared warehouse. The
generated backend SQL and export rule agree over the shared 41-case numeric fixture.
Real browser captures use fixture warehouse routes populated from those local Spark
results. They prove the chart controls and rendering, not AWS delivery or a Databricks
deployment. Re-probe the generated SQL on the target Databricks runtime through an
authorized read before activation. Mobile visual verification needs an approved device.
