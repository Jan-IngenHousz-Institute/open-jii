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
- **Java 11+**: required by the local PySpark used in tests.

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
pnpm typecheck         # pyright
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
