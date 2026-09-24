"""Runtime configuration read from ``spark.conf`` at import time.

Only safe to import inside the running pipeline (or any other context with an
active Spark session); see ``openjii.centrum.runtime`` for the rationale. Tests
that load a macro notebook stub this module in ``sys.modules``.
"""

from __future__ import annotations

from pyspark.sql import SparkSession

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


ENVIRONMENT: str = _with_default("ENVIRONMENT", "dev").lower()
CATALOG_NAME: str = _required("CATALOG_NAME")
CENTRUM_SCHEMA_NAME: str = _with_default("CENTRUM_SCHEMA_NAME", "centrum")


def centrum_table(name: str) -> str:
    """Fully qualified centrum table name for cross-pipeline reads."""
    return f"{CATALOG_NAME}.{CENTRUM_SCHEMA_NAME}.{name}"


def _positive_int(key: str, default: int) -> int:
    try:
        value = int(_with_default(key, str(default)))
    except ValueError as error:
        raise ValueError(f"{key} must be a positive integer") from error
    if value < 1:
        raise ValueError(f"{key} must be a positive integer")
    return value


# Admission changes apply only after a previously planned batch completes.
MACRO_MAX_FILES_PER_TRIGGER = _positive_int("MACRO_MAX_FILES_PER_TRIGGER", 16)
MACRO_MAX_BYTES_PER_TRIGGER = _positive_int("MACRO_MAX_BYTES_PER_TRIGGER", 16 * 1024 * 1024)
MACRO_EXECUTION_PARTITIONS = _positive_int("MACRO_EXECUTION_PARTITIONS", 16)
