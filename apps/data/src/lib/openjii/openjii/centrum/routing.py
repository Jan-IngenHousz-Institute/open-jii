"""Pure DataFrame routing for workbook terminal control records."""

from __future__ import annotations

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

WORKBOOK_RUN_COMPLETE_RECORD_KIND = "workbook_run_complete"


def workbook_control_records(records: DataFrame) -> DataFrame:
    return records.filter(F.col("record_kind") == WORKBOOK_RUN_COMPLETE_RECORD_KIND)


def measurement_records(records: DataFrame) -> DataFrame:
    """Exclude controls before the caller applies the sensor payload schema."""
    return records.filter(
        F.col("record_kind").isNull() | (F.col("record_kind") != WORKBOOK_RUN_COMPLETE_RECORD_KIND)
    )
