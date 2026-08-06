"""Safe timezone normalization for enriched measurement views.

The source ``timezone`` value is user/device supplied. Spark's
``from_utc_timestamp`` raises for an unknown zone ID, so passing that column
through directly lets one legacy value fail an entire materialized-view update.
This module validates the value with Spark-native expressions first and only
passes a canonical, known-safe value to Spark's timezone conversion.
"""

from __future__ import annotations

import re
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones

from pyspark.sql import DataFrame
from pyspark.sql import functions as F

# Historical JII provisioning used AMT as shorthand for Amsterdam. AMT is not
# an IANA zone ID (and is ambiguous globally), so Spark/Java correctly rejects
# it. Keep the migration deliberately narrow instead of accepting arbitrary
# abbreviations.
LEGACY_TIMEZONE_ALIASES = {"AMT": "Europe/Amsterdam"}

_OFFSET_PATTERN = r"^([+-])(\d{2})(?::(\d{2})(?::(\d{2}))?)?$"
_OFFSET_RE = re.compile(_OFFSET_PATTERN)
_VALID_IANA_TIMEZONES = tuple(sorted(available_timezones() | {"UTC"}))


def _valid_zone_offset(value: str) -> bool:
    """Return whether *value* is a Spark-supported ``+/-HH[:mm[:ss]]`` offset."""
    match = _OFFSET_RE.fullmatch(value)
    if match is None:
        return False
    hour = int(match.group(2))
    minute = int(match.group(3) or 0)
    second = int(match.group(4) or 0)
    return hour <= 18 and minute <= 59 and second <= 59 and (hour < 18 or (minute == 0 and second == 0))


@lru_cache(maxsize=512)
def canonical_timezone(value: str | None) -> str | None:
    """Return a safe Spark timezone or ``None`` for missing/unknown input.

    The received value is not rewritten in the measurement table; this return
    value is an internal conversion operand. That preserves provenance while
    preventing bad data from aborting the pipeline.
    """
    if value is None:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    candidate = LEGACY_TIMEZONE_ALIASES.get(candidate, candidate)
    if candidate == "Z":
        return "UTC"
    if _valid_zone_offset(candidate):
        return candidate
    try:
        ZoneInfo(candidate)
    except (ZoneInfoNotFoundError, ValueError):
        return None
    return candidate


def _valid_zone_offset_column(candidate):
    """Spark expression matching the same bounded offset grammar as Python."""
    matches = candidate.rlike(_OFFSET_PATTERN)
    hour = F.regexp_extract(candidate, _OFFSET_PATTERN, 2).cast("int")
    minute = F.coalesce(F.regexp_extract(candidate, _OFFSET_PATTERN, 3).cast("int"), F.lit(0))
    second = F.coalesce(F.regexp_extract(candidate, _OFFSET_PATTERN, 4).cast("int"), F.lit(0))
    return matches & (hour <= 18) & (minute <= 59) & (second <= 59) & ((hour < 18) | ((minute == 0) & (second == 0)))


def _canonical_timezone_column(source):
    """Return a Spark column containing only conversion-safe timezone IDs."""
    candidate = F.trim(source)
    return (
        F.when(candidate == "AMT", F.lit("Europe/Amsterdam"))
        .when(candidate == "Z", F.lit("UTC"))
        .when(candidate.isin(*_VALID_IANA_TIMEZONES), candidate)
        .when(_valid_zone_offset_column(candidate), candidate)
    )


def add_local_time_columns(
    df: DataFrame,
    *,
    utc_column: str = "measurement_time_utc",
    timezone_column: str = "timezone",
) -> DataFrame:
    """Add safe local-time projections and a timezone validation signal.

    ``timezone`` remains byte-for-byte as received. ``timezone_valid`` is true
    for a missing value (local time was not requested) or a recognized zone,
    and false for a non-empty value that could not be validated. Invalid values
    produce null derived local-time columns instead of a Spark exception.
    """
    effective_column = "__effective_timezone"
    original = F.col(timezone_column)
    effective = F.col(effective_column)

    return (
        df.withColumn(effective_column, _canonical_timezone_column(original))
        .withColumn(
            "timezone_valid",
            original.isNull() | (F.length(F.trim(original)) == 0) | effective.isNotNull(),
        )
        .withColumn(
            "measurement_time_local",
            F.when(
                effective.isNotNull(),
                F.date_format(F.from_utc_timestamp(F.col(utc_column), effective), "yyyy-MM-dd HH:mm:ss"),
            ),
        )
        .withColumn(
            "local_time",
            F.when(
                effective.isNotNull(),
                F.date_format(F.from_utc_timestamp(F.col(utc_column), effective), "HH:mm"),
            ),
        )
        .drop(effective_column)
    )
