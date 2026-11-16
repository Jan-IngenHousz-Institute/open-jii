# Data pipelines

`apps/data`, the Databricks side. It is a uv workspace with its own Python toolchain, outside the
pnpm dev loop, and it deploys as a Databricks Asset Bundle.

The lakehouse layout and the medallion layers are described in the architecture decision records
under `apps/docs/content/developers/design-decisions/`. This document is about the code.

## Read first

- `apps/data/README.md` for the toolchain and the commands.
- `apps/data/databricks.yml`, which decides what gets built and what gets synced.
- `apps/data/tests/conftest.py`, which is what lets a pipeline be tested off-platform.

## Shape

```text
src/lib/<package>/      four uv workspace members: ambyte, data_repair, enrich, openjii
src/pipelines/centrum/  bronze, silver and gold, hooks.py, and the serving store feed
src/pipelines/macros/   the dedicated macro execution pipeline and its serving store feed
src/pipelines/metrics/  the platform metric tables, 13 files
src/tasks/              workflow tasks, notebook-style
src/notebooks/          user-facing notebooks
src/views/              SQL views over the centrum tables, created by terraform
tests/lib/              pytest, flat, 54 files
tests/fixtures/         shared JSON inputs
```

`openjii` is the shared library every pipeline imports. It holds the table names, runtime constants
and schemas, the helpers that read experiment tables, the heartbeat collectors, and the code that
feeds and reloads the serving store. There is no other shared module and nothing is imported
between pipelines.

## Rules

1. Reusable code goes in `src/lib/<package>` and ships as a wheel. A pipeline file imports from it
   and holds no logic worth reusing. If you are tempted to import one pipeline from another, the
   shared part belongs in `openjii`. [review]
2. A pipeline file is a Databricks notebook, with the `# Databricks notebook source` header and
   `# COMMAND ----------` separators. A table is declared with `@dlt.table`, and its
   `table_properties` quality marker stays accurate for the layer it sits in. A feed to the serving
   store declares a sink and a flow with `pyspark.pipelines` instead. [review]
3. Table names, stream names and credential names come from `openjii.centrum.constants` and
   `openjii.centrum.runtime`, or their metrics equivalents. No literal table name in a pipeline.
   [review]
4. A layer directory means what it says. Bronze ingests, silver cleans and gold serves, and the
   enriched joins are SQL views, not a layer. A gold table that cleans its own input is in the wrong
   layer. [review]
5. Columns map from source to sink without being renamed or deduplicated on the way out. If an
   export fails because the shape is wrong, fix the contract upstream rather than reshaping it at
   the sink, because the sink is where the lineage becomes untraceable. [review]
6. Tests go in `tests/lib/` and use the `spark`, `fake_dlt` and `fake_dp` fixtures from
   `conftest.py`. `fake_dlt` makes the `dlt` decorators identity functions and `fake_dp` records the
   sinks and flows a notebook declares, so a pipeline module can be imported and exercised without a
   Databricks runtime. [review]
7. Keep line length under 110, and let the formatter handle new code.
   [lint: ruff E] [lint: ruff F] [lint: ruff W] [lint: ruff I] [lint: ruff B] [lint: ruff UP]
   [lint: ruff SIM] [lint: ruff RUF]
8. The serving store is fed from gold's change feed. A column added to a gold table that the store
   serves needs the store migration in `packages/database/clickhouse/migrations`, the feed in
   `openjii.serving_store` and the backend's store read, shipped together. A row gold removes stays
   in the store until a reload, which follows `docs/runbooks/procedures/serving-store-reload.md`.
   [review]
9. The enriched joins are SQL views in `src/views/`, created by terraform, and they hold no data. A
   view change that adds a column is applied before the backend that reads it is deployed, and
   every backend instance restarts afterwards to drop its cached column list. A view has a test
   that runs its SQL over small tables. [review]
10. A field added to or removed from the ingest schemas in
    `src/lib/openjii/openjii/centrum/schemas.py`, or from the bronze raw data pipeline, changes
    `asyncapi.yaml` in the same pull request. [ci: Docs API Spec Drift Check]
11. A heartbeat metric name is a constant in `openjii.heartbeat`, listed in
    `tests/lib/test_heartbeat_observations.py` and bound by the same literal in
    `docs/monitoring/metrics-catalog.yaml`, so renaming one does not silently darken the series the
    alert rules watch. [review]

## Patterns

**Adding a table.** Decide its layer, add the file under that layer's directory, take its name from
the constants module, and declare it with the quality property the layer uses. Then add a test in
`tests/lib/` for whatever logic it calls into the library.

**Testing without a cluster.** The session-scoped `spark` fixture runs locally on two cores with two
shuffle partitions, which is enough for assertions about transformations. `responses` stubs HTTP.

**Deploying.** `databricks.yml` builds one wheel per workspace member and syncs only
`src/pipelines/**`, `src/tasks/**` and `src/notebooks/**`. Pipelines and workflows are defined in
`infrastructure/`, so a new pipeline file runs only once its path is listed there. The SQL views
under `src/views/` are created by terraform, not by the bundle.

**Macro results.** Macro execution runs in its own pipeline, because its tasks wait on sandbox
requests and would otherwise hold the slots the ingest pipeline's reader needs.

## Tests

pytest, 54 files, all under `tests/lib/` in a flat layout rather than mirroring `src/lib`. They
cover the libraries, import pipeline and task modules through the `dlt` and `pyspark.pipelines`
fakes, and run view SQL against small tables. Tests marked `clickhouse` need a throwaway ClickHouse
at `CLICKHOUSE_TEST_URL` and are skipped without one. CI does not provide one, so they run only
locally.

## Known debt

Ruff excludes `src/pipelines`, `src/tasks` and `src/notebooks`, and pyright only includes `src/lib`
and `tests`. Everything that actually runs in production, 46 files and about 6,200 lines, is
therefore outside both checks, which is the largest gap in this app. Bringing the pipelines under
ruff with per-file ignores for the notebook cell markers is the tractable first step; pyright can
follow. Needs a ticket.

`src/pipelines/photosynq_project_import_wip_pipeline.py` sits at the pipelines root, in no layer,
with "wip" in its name. It is fixed to one hackathon dataset and nothing in `infrastructure/`
refers to it, so no pipeline runs it. Delete it or move it to `src/notebooks`. No ticket.

`src/pipelines/centrum/gold/sources.py` reads `experiment_custom_metadata` by literal name, against
rule 3. Add the name to `openjii.centrum.constants`. No ticket.

`chispa` is declared as a test dependency in `pyproject.toml` and nothing imports it. Remove it or
use it. No ticket.

`E501` is ignored globally with the comment that existing code is wide. That is honest, and it means
line length is enforced only on code the formatter touches. No ticket.

## Decisions

- 2026-09-21. Tests stay in a flat `tests/lib/` rather than mirroring the source tree. Sixteen files
  do not need a hierarchy, and pytest discovery is simpler for it.
- 2026-09-21. `B008` stays ignored, because Spark user-defined functions legitimately call functions
  in default arguments.
- 2026-11-16. Reconciled with main, so the layout, the counts, the rules and the debt lines follow
  the code as it stands.
