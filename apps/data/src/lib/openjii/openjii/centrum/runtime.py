"""Runtime configuration read from ``spark.conf`` at import time.

This module is **only safe to import inside the running pipeline** (or any
other context with an active Spark session). Importing it without one will
fail when ``SparkSession.builder.getOrCreate()`` cannot satisfy.

Tests should not import this module; import ``openjii.centrum.schemas`` /
``openjii.centrum.constants`` instead.
"""

from __future__ import annotations

from pyspark.sql import SparkSession

from .constants import BRONZE_TABLE_DEFAULT, SILVER_TABLE_DEFAULT

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

BRONZE_TABLE: str = _with_default("BRONZE_TABLE", BRONZE_TABLE_DEFAULT)
SILVER_TABLE: str = _with_default("SILVER_TABLE", SILVER_TABLE_DEFAULT)

KINESIS_STREAM_NAME: str = _required("KINESIS_STREAM_NAME")
CHECKPOINT_PATH: str = _required("CHECKPOINT_PATH")
SERVICE_CREDENTIAL_NAME: str = _required("SERVICE_CREDENTIAL_NAME")
MONITORING_SLACK_CHANNEL: str = _required("MONITORING_SLACK_CHANNEL")

# S3 prefix holding large IoT payloads (>128 KB) uploaded via pre-signed URL.
LARGE_IOT_S3_PATH: str = _required("LARGE_IOT_S3_PATH")

# Path to the legacy-macro-id-to-UUID map JSON in the centrum data-legacy volume.
# Some early data was published before macros had UUIDs; the silver layer
# rewrites those legacy ids into UUIDs via this map so downstream tables stay
# consistent.
LEGACY_MACRO_ID_MAP_PATH: str = (
    f"/Volumes/{CATALOG_NAME}/centrum/data-legacy/internal/legacy_macro_id_map.json"
)


def _load_legacy_macro_id_map() -> dict[str, str]:
    """Load legacy→UUID mapping from the volume JSON file. Returns empty dict on failure."""
    import json

    try:
        with open(LEGACY_MACRO_ID_MAP_PATH) as f:
            mapping = json.load(f)
        print(f"[INFO] Loaded {len(mapping)} legacy macro ID mappings from {LEGACY_MACRO_ID_MAP_PATH}")
        return mapping
    except Exception as e:
        print(f"[WARN] Legacy macro ID map not found or unreadable at {LEGACY_MACRO_ID_MAP_PATH}: {e}")
        return {}


LEGACY_MACRO_ID_MAP: dict[str, str] = _load_legacy_macro_id_map()
