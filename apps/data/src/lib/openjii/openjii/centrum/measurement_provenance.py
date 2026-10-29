"""Measurement labels, independent of contributor names and upload authorization."""

from pyspark.sql import Column, DataFrame
from pyspark.sql import functions as F

_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
_UPLOAD_KEY = rf"^(?:s3a?://[^/]+/)?large-iot/({_UUID})/(guest/)?(?:({_UUID})/)?{_UUID}\.json$"


def is_simulated(marker: Column, device_id: Column) -> Column:
    return F.coalesce(marker, F.lit(False)) | F.coalesce(device_id.startswith("simulated:"), F.lit(False))


def parse_large_iot_key(file_path: Column) -> Column:
    """Parse current and legacy keys; unmatched paths have null IDs and a false guest flag."""
    experiment = F.regexp_extract(file_path, _UPLOAD_KEY, 1)
    uploader = F.regexp_extract(file_path, _UPLOAD_KEY, 3)
    return F.struct(
        F.when(experiment != "", F.lower(experiment)).alias("experiment_id"),
        F.when(uploader != "", F.lower(uploader)).alias("uploader_id"),
        F.coalesce(F.regexp_extract(file_path, _UPLOAD_KEY, 2) == "guest/", F.lit(False)).alias("is_guest"),
    )


def with_provenance_defaults(df: DataFrame) -> DataFrame:
    for name in ("is_simulated", "is_guest"):
        value = F.col(name) if name in df.columns else F.lit(False)
        df = df.withColumn(name, F.coalesce(value, F.lit(False)))
    return df
