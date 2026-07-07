"""Pure string constants used by the centrum DLT pipeline.

No Spark session dependency. Safe to import anywhere.
"""

from __future__ import annotations

# Bronze / silver table-name *defaults*. The actual table names used by the
# pipeline are read from spark.conf in ``runtime.py`` so they can be overridden
# per-environment without recompiling the wheel.
BRONZE_TABLE_DEFAULT = "raw_data"
SILVER_TABLE_DEFAULT = "clean_data"

# Gold layer
EXPERIMENT_STATUS_TABLE = "experiment_status"
EXPERIMENT_RAW_DATA_TABLE = "experiment_raw_data"
EXPERIMENT_DEVICE_DATA_TABLE = "experiment_device_data"
EXPERIMENT_MACRO_DATA_TABLE = "experiment_macro_data"
EXPERIMENT_CONTRIBUTORS_TABLE = "experiment_contributors"
EXPERIMENT_DEVICES_TABLE = "experiment_devices"
EXPERIMENT_TABLE_METADATA = "experiment_table_metadata"
EXPERIMENT_UPLOADED_DATA_TABLE = "experiment_uploaded_data"

# Enriched (gold)
ENRICHED_RAW_DATA_VIEW = "enriched_experiment_raw_data"
ENRICHED_MACRO_DATA_VIEW = "enriched_experiment_macro_data"
ENRICHED_UPLOADED_DATA_VIEW = "enriched_experiment_uploaded_data"

# Streaming bronze (non-Kinesis sources)
RAW_IMPORTED_DATA_TABLE = "raw_imported_data"
RAW_UPLOADED_DATA_TABLE = "raw_uploaded_data"

# DLT mirrors of backend-managed tables
ANNOTATIONS_SOURCE_TABLE = "experiment_annotations_source"
METADATA_SOURCE_TABLE = "experiment_metadata_source"

# Backend's macro batch endpoint requires UUID macro_ids; non-UUIDs trigger
# request-wide 400s. Gate at gold so bad rows never reach the UDF.
MACRO_ID_UUID_PATTERN = r"(?i)\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z"
