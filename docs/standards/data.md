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
src/pipelines/centrum/  bronze, silver, enriched, gold, plus hooks.py
src/pipelines/metrics/  the aggregate pipeline
src/tasks/              workflow tasks, notebook-style
src/notebooks/          user-facing notebooks
tests/lib/              pytest, flat, 16 files
```

`openjii` is the shared library every pipeline imports, holding the table names, the runtime
constants and the schemas. There is no other shared module and nothing is imported between
pipelines.

## Rules

1. Reusable code goes in `src/lib/<package>` and ships as a wheel. A pipeline file imports from it
   and holds no logic worth reusing. If you are tempted to import one pipeline from another, the
   shared part belongs in `openjii`. [review]
2. A pipeline file is a Databricks notebook, with the `# Databricks notebook source` header and
   `# COMMAND ----------` separators, declaring tables with `@dlt.table`. Keep the
   `table_properties` quality marker accurate for the layer it sits in. [review]
3. Table names, stream names and credential names come from `openjii.centrum.runtime` or its
   metrics equivalent. No literal table name in a pipeline. [review]
4. A layer directory means what it says. Bronze ingests, silver cleans, enriched joins, gold
   serves. A gold table that cleans its own input is in the wrong layer. [review]
5. Columns map from source to sink without being renamed or deduplicated on the way out. If an
   export fails because the shape is wrong, fix the contract upstream rather than reshaping it at
   the sink, because the sink is where the lineage becomes untraceable. [review]
6. Tests go in `tests/lib/` and use the `spark` and `fake_dlt` fixtures from `conftest.py`. The fake
   makes `dlt` decorators identity functions, so a pipeline module can be imported and exercised
   without a Databricks runtime. [review]
7. Keep line length under 110, and let the formatter handle new code.
   [lint: ruff E] [lint: ruff F] [lint: ruff I] [lint: ruff B] [lint: ruff UP] [lint: ruff SIM]
   [lint: ruff RUF]

## Patterns

**Adding a table.** Decide its layer, add the file under that layer's directory, take its name from
the constants module, and declare it with the quality property the layer uses. Then add a test in
`tests/lib/` for whatever logic it calls into the library.

**Testing without a cluster.** The session-scoped `spark` fixture runs locally on two cores with two
shuffle partitions, which is enough for assertions about transformations. `chispa` compares
DataFrames and `responses` stubs HTTP.

**Deploying.** `databricks.yml` builds one wheel per workspace member and syncs only
`src/pipelines/**`, `src/tasks/**` and `src/notebooks/**`. A file outside those three trees is not
deployed, however correct it is.

## Tests

pytest, 17 files, all under `tests/lib/` in a flat layout rather than mirroring `src/lib`. They
cover the libraries. The pipelines themselves are only covered where they call into a library.

## Known debt

Ruff excludes `src/pipelines`, `src/tasks` and `src/notebooks`, and pyright only includes `src/lib`
and `tests`. Everything that actually runs in production is therefore outside both checks, which is
the largest gap in this app. Bringing the pipelines under ruff with per-file ignores for the
notebook cell markers is the tractable first step; pyright can follow. Needs a ticket.

`src/pipelines/photosynq_project_import_wip_pipeline.py` sits at the pipelines root, in no layer,
with "wip" in its name. Either it belongs in a layer or it belongs in `src/notebooks`. No ticket.

`E501` is ignored globally with the comment that existing code is wide. That is honest, and it means
line length is enforced only on code the formatter touches. No ticket.

## Decisions

- 2026-09-21. Tests stay in a flat `tests/lib/` rather than mirroring the source tree. Sixteen files
  do not need a hierarchy, and pytest discovery is simpler for it.
- 2026-09-21. `B008` stays ignored, because Spark user-defined functions legitimately call functions
  in default arguments.
