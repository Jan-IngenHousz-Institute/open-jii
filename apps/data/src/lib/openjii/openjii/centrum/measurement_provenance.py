"""Measurement labels, independent of contributor names and upload authorization."""

from pyspark.sql import Column, DataFrame
from pyspark.sql import functions as F

_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
_GUEST_KEY = rf"^(?:s3a?://[^/]+/)?large-iot/{_UUID}/guest/{_UUID}\.json$"


def is_simulated(marker: Column, device_id: Column) -> Column:
    return F.coalesce(marker, F.lit(False)) | F.coalesce(device_id.startswith("simulated:"), F.lit(False))


def is_guest_upload(file_path: Column) -> Column:
    return F.coalesce(file_path.rlike(_GUEST_KEY), F.lit(False))


def with_provenance_defaults(df: DataFrame) -> DataFrame:
    for name in ("is_simulated", "is_guest"):
        value = F.col(name) if name in df.columns else F.lit(False)
        df = df.withColumn(name, F.coalesce(value, F.lit(False)))
    return df
