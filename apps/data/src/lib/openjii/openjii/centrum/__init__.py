"""Shared building blocks for the centrum DLT pipeline.

Two import surfaces:

* ``openjii.centrum.schemas`` and ``openjii.centrum.constants`` are pure
  Python / PySpark types with **no Spark session dependency**. Safe to
  import from anywhere (tests, tooling, notebooks).
* ``openjii.centrum.runtime`` reads ``spark.conf`` eagerly on import and is
  intended for use **only inside the running pipeline**. Importing it
  outside an active Spark session raises.

The package ``__init__`` only re-exports the spark-free surface, so plain
``from openjii.centrum import sensor_schema`` never tries to read Spark
config.
"""

from .constants import (
    ANNOTATIONS_SOURCE_TABLE,
    BRONZE_TABLE_DEFAULT,
    ENRICHED_MACRO_DATA_VIEW,
    ENRICHED_RAW_DATA_VIEW,
    ENRICHED_UPLOADED_DATA_VIEW,
    EXPERIMENT_CONTRIBUTORS_TABLE,
    EXPERIMENT_DEVICE_DATA_TABLE,
    EXPERIMENT_DEVICES_TABLE,
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    EXPERIMENT_STATUS_TABLE,
    EXPERIMENT_TABLE_METADATA,
    EXPERIMENT_UPLOADED_DATA_TABLE,
    MACRO_ID_UUID_PATTERN,
    METADATA_SOURCE_TABLE,
    RAW_IMPORTED_DATA_TABLE,
    RAW_LARGE_DATA_TABLE,
    RAW_UPLOADED_DATA_TABLE,
    SILVER_TABLE_DEFAULT,
)
from .schemas import (
    annotation_content_schema,
    annotation_schema,
    large_iot_schema,
    macro_schema,
    question_schema,
    sensor_schema,
)

__all__ = [
    # constants
    "ANNOTATIONS_SOURCE_TABLE",
    "BRONZE_TABLE_DEFAULT",
    "ENRICHED_MACRO_DATA_VIEW",
    "ENRICHED_RAW_DATA_VIEW",
    "ENRICHED_UPLOADED_DATA_VIEW",
    "EXPERIMENT_CONTRIBUTORS_TABLE",
    "EXPERIMENT_DEVICES_TABLE",
    "EXPERIMENT_DEVICE_DATA_TABLE",
    "EXPERIMENT_MACRO_DATA_TABLE",
    "EXPERIMENT_RAW_DATA_TABLE",
    "EXPERIMENT_STATUS_TABLE",
    "EXPERIMENT_TABLE_METADATA",
    "EXPERIMENT_UPLOADED_DATA_TABLE",
    "MACRO_ID_UUID_PATTERN",
    "METADATA_SOURCE_TABLE",
    "RAW_IMPORTED_DATA_TABLE",
    "RAW_LARGE_DATA_TABLE",
    "RAW_UPLOADED_DATA_TABLE",
    "SILVER_TABLE_DEFAULT",
    # schemas
    "annotation_content_schema",
    "annotation_schema",
    "large_iot_schema",
    "macro_schema",
    "question_schema",
    "sensor_schema",
]
