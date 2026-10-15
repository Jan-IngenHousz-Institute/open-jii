# OpenJII Data

Databricks notebooks, pipelines, and Python packages for openJII data ingestion and analysis.

## Layout

```text
src/
├── lib/                         # Internal Python packages (uv workspace members; deployed as wheels)
│   ├── ambyte/                  # Ambyte trace file parsing + volume I/O
│   ├── enrich/                  # Backend API client, user / annotation / macro / metadata enrichment
│   ├── openjii/                 # Catalog-aware helpers, decompression, table loaders
│   └── data_repair/             # @inline_repair decorator framework for known-corruption patches
├── pipelines/                   # Databricks DLT pipeline definitions
├── tasks/                       # Databricks workflow tasks (notebook-style scripts)
└── notebooks/                   # User-facing notebooks (e.g. data_hackathon_2026)

tests/lib/                       # pytest suites for the four libs
databricks.yml                   # Asset Bundle config (artifacts + notebook sync)
pyproject.toml                   # uv workspace root, ruff / pyright / pytest config
```

## Prerequisites

- **uv**: Python toolchain. Install with `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **Databricks CLI**: for `databricks bundle …` commands.
- **Java 17 or 21**: required by the local PySpark 4 test runtime.

## Setup

```bash
# Sync the project venv (.venv) and install all four lib workspace members
# in editable mode plus dev dependencies (pytest, chispa, ruff, pyright, …).
uv sync
```

The Python version is pinned via `.python-version` (3.11). uv will install it automatically if missing.

## Common tasks

All scripts go through `pnpm` so they integrate with the monorepo's turbo pipeline; each one wraps a `uv run …` invocation.

```bash
pnpm test              # pytest
pnpm test:cov          # pytest + coverage
pnpm lint              # ruff check
pnpm format            # ruff format
pnpm check-types       # pyright
pnpm build             # uv build --all-packages → dist/*.whl per lib
pnpm validate:dev      # databricks bundle validate -t dev
pnpm validate:prod     # databricks bundle validate -t prod
```

You can run the underlying tools directly too:

```bash
uv run pytest -m "not spark"        # skip Spark-fixture tests for fast feedback
uv run pytest tests/lib/test_compression.py -v
uv run ruff check --fix .
uv build --all-packages
```

## Tests

The test suite covers the pure-logic surface of each library: compression, HMAC signing, batching and chunked-error paths in the backend client, question-label sanitization and Spark-side column expansion, the repair-manifest registry (severity + predicate filtering), the RIDES re-interleave algorithm, and the upload-directory parser.

Tests that require a SparkSession are scoped to a single session-level fixture in `tests/conftest.py` and gated behind the `spark` marker. There is also a `fake_dlt` fixture that injects a stub `dlt` module so DLT pipeline files can be imported in tests without crashing.

## Catalog configuration

`openjii.get_catalog_name()` resolves at call time from:

1. `spark.conf` key `CATALOG_NAME` (set by DLT pipelines, cluster Spark config, or terraform).
2. Environment variable `OPENJII_CATALOG`.

Earlier versions injected this into `_config.py` at wheel-build time (one wheel per environment); the runtime resolution lets a single artifact serve all environments.

## Building & deploying

`pnpm build` produces wheels for every lib via `uv build --all-packages` (these end up in `dist/`).

The Databricks bundle (`databricks.yml`) builds wheels and uploads notebooks via `databricks bundle deploy`. CI for that is in [.github/workflows/deploy-databricks.yml](../../.github/workflows/deploy-databricks.yml). Pipeline and job definitions themselves live in terraform, not in the bundle.

## Verify numeric question sorting

The backend orders historical STRING question answers before paging. Run its real
repository and adapter SQL against this workspace's pinned Spark 4 runtime:

```bash
pnpm build:packages
SPARK_LOCAL_IP=127.0.0.1 pnpm --filter data verify:numeric-question-sorting --output /tmp/numeric-question-sorting.json
```

Run `uv sync --frozen` in `apps/data` first if its virtualenv is missing. Java 17
or 21 and the installed pnpm workspace dependencies are required. Set `JAVA_HOME`
if the default Java installation is a different version. No database,
Databricks credentials or running app is needed. The Python runner owns temporary
local parquet VARIANT tables and calls the current backend emitter in
`apps/backend/scripts/verify-numeric-question-sorting.ts` over a loopback SQL bridge.
The emitter invokes the real repository and adapter, including ID-first payload
assembly and picker truncation. The JSON output records executed SQL, schemas,
responses, Spark version, ANSI settings and timings. An assertion failure exits
nonzero. `--skip-perf` runs only correctness checks.

This is an explicit local verification command, outside the default pytest/Vitest
and CI suites. It covers both ANSI modes, source-name collisions, filtered and
unfiltered paging, DISTINCT and exact numeric boundaries. The optional benchmark
uses cached parquet data at 100k and 1M rows with full-row and ID-only projections.
Its lexical comparison uses current generated SQL with numeric classification
disabled in the test adapter. It does not replay an old checkout. Historical
negative-control evidence belongs in the OJD-1856 review artifacts.

### Numeric policy

Signed ASCII base-10 integers and ordinary decimals, including `.5` and `1.`, are
numeric only when exactly representable as `DECIMAL(38,18)`: at most 20 significant
integer digits and 18 meaningful fractional places. Leading integer zeros and
trailing fractional zeros do not consume those budgets. The grammar check runs
before `try_cast`, which alone would round excess fractional places. Scientific
notation, separators, units, non-ASCII digits, overflow and excess precision use
text ordering. Whitespace U+0009 through U+000D and U+0020 is ignored for numeric
recognition and blank detection; NBSP and other Unicode whitespace use text
ordering. Returned/exported strings are unchanged.

Numeric answers precede text and blanks/nulls in both directions. Values within
the numeric and text groups follow the requested direction. Ties use the original
answer in that direction, then row identity ascending outside DISTINCT. The
picker deduplicates original strings and strips null/empty values at its existing
API boundary. Native-typed question fields, other text sources and aggregation
outputs do not use the STRING-answer classification.
