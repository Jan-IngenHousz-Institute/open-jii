# OpenJII Data

Databricks notebooks and Python packages for OpenJII data processing and analysis.

## Packages

This project contains three main packages:

- **ambyte** - Ambyte data processing utilities
- **enrich** - Data enrichment utilities for ELT pipelines (backend API client, user metadata, annotations, macro execution)
- **openjii** - OpenJII Data Analysis Helpers for Databricks

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
