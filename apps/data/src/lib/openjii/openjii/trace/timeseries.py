"""Notebook-side transcription of the ``trace_points`` rule (contract §6).

The same statement as the SQL table function, for use where a warehouse call is
inconvenient:

    t_ms(i) = time.start_utc + 1000 · (t[i] | t0 + i·dt)

``to_timeseries`` accepts a v2 or a v3 measurement (and either the stored object
or the firmware's one-element ``sample`` array), so notebooks need no dual-read
branch of their own.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .contract import SERIES_UNITS, round_half_up, series_offsets
from .normalize import normalize_trace

# Column order matches the SQL table function's RETURNS TABLE.
COLUMNS = ("series", "t", "value", "unit")


def to_records(measurement: Any, event_time_ms: int | None = None) -> list[dict]:
    """Explode a measurement into ``series, t, value, unit`` records.

    ``t`` is a timezone-aware UTC ``datetime``; it is ``None`` when the series
    is malformed (neither explicit ``t`` nor ``dt``) or the object has no
    ``time.start_utc`` to anchor against.
    """
    trace = normalize_trace(measurement, event_time_ms=event_time_ms)
    if not isinstance(trace, dict):
        return []
    series_map = trace.get("series")
    if not isinstance(series_map, dict):
        return []

    start_utc = (trace.get("time") or {}).get("start_utc")
    records: list[dict] = []
    for name, series in series_map.items():
        if not isinstance(series, dict):
            continue
        values = series.get("v")
        if not isinstance(values, list):
            continue
        unit = series.get("u") or SERIES_UNITS.get(name)
        offsets = series_offsets(series, len(values))
        for value, offset in zip(values, offsets, strict=True):
            records.append(
                {
                    "series": name,
                    "t": _instant(start_utc, offset),
                    "value": float(value) if isinstance(value, (int, float)) else None,
                    "unit": unit,
                }
            )
    return records


def to_timeseries(measurement: Any, event_time_ms: int | None = None, spark: Any = None):
    """Return a Spark DataFrame of ``series, t, value, unit`` for one measurement.

    Mirrors ``<catalog>.<schema>.trace_points(data)``; use the SQL function when
    exploding many rows, and this when you already hold a single payload.
    """
    from pyspark.sql import SparkSession
    from pyspark.sql.types import (
        DoubleType,
        StringType,
        StructField,
        StructType,
        TimestampType,
    )

    session = spark or SparkSession.getActiveSession() or SparkSession.builder.getOrCreate()
    schema = StructType(
        [
            StructField("series", StringType(), True),
            StructField("t", TimestampType(), True),
            StructField("value", DoubleType(), True),
            StructField("unit", StringType(), True),
        ]
    )
    records = to_records(measurement, event_time_ms=event_time_ms)
    rows = [tuple(record[column] for column in COLUMNS) for record in records]
    return session.createDataFrame(rows, schema=schema)


def _instant(start_utc: Any, offset: float | None) -> datetime | None:
    if start_utc is None or offset is None:
        return None
    # Nearest millisecond, not truncation: 15·0.854 is 12.809999999999999 in
    # binary floating point, and a timestamp must not slip a millisecond for it.
    epoch_ms = round_half_up(float(start_utc) + 1000.0 * float(offset))
    return datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
