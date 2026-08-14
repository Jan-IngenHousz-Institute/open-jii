"""Runtime configuration read from ``spark.conf`` at import time.

Only safe to import inside the running pipeline (or any other context with an
active Spark session); see ``openjii.centrum.runtime`` for the rationale.
Tests should import ``openjii.metrics`` instead.
"""

from __future__ import annotations

from pyspark.sql import SparkSession

from openjii.centrum import SILVER_TABLE_DEFAULT

_spark = SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()


def _required(key: str) -> str:
    """Read a required Spark conf key. Raise loudly if it isn't configured:
    the pipeline cannot run without these and an unset value silently
    coalescing to None would surface as confusing errors deep inside DLT."""
    value = _spark.conf.get(key, None)
    if value is None:
        raise RuntimeError(
            f"Required Spark conf '{key}' is not set. "
            "Configure it on the DLT pipeline or cluster Spark config."
        )
    return value


def _with_default(key: str, default: str) -> str:
    """Read a Spark conf key, falling back to ``default`` if unset."""
    return _spark.conf.get(key, default) or default


CATALOG_NAME: str = _required("CATALOG_NAME")
CENTRUM_SCHEMA_NAME: str = _with_default("CENTRUM_SCHEMA_NAME", "centrum")
SILVER_TABLE: str = _with_default("SILVER_TABLE", SILVER_TABLE_DEFAULT)


def centrum_table(name: str) -> str:
    """Fully qualified centrum table name for cross-pipeline reads."""
    return f"{CATALOG_NAME}.{CENTRUM_SCHEMA_NAME}.{name}"
