# OpenJII Data

Databricks notebooks and Python packages for OpenJII data processing and analysis.

## Packages

This project contains four main packages:

- **multispeq** - MultispeQ data processing utilities
- **ambyte** - Ambyte data processing utilities
- **enrich** - Data enrichment utilities for Databricks pipelines
- **openjii** - OpenJII data analysis helpers for Databricks

## Development

### Setup

```bash
# Install Poetry (if not already installed)
pip3 install poetry

# Install dependencies and create virtual environment
poetry install

# Activate the virtual environment
poetry shell
```

### Testing

```bash
# Run tests with coverage
poetry run pytest --cov=src/lib --cov-report=term

# Or use the npm script
pnpm test
```

### Building

```bash
# Build distribution packages
poetry build

# Or use the npm script
pnpm build
```

## Structure

- `src/lib/` - Python packages
- `src/notebooks/` - Databricks notebooks
- `src/pipelines/` - Databricks pipeline definitions
- `src/tasks/` - Databricks task definitions
